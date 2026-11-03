"""Exercise an explicitly selected disposable Nextcloud instance (stdlib only).

Creates uniquely named test users/group and removes them in finally.
Credentials are read from a local env file; never passed in command arguments.
"""
import argparse
import base64
import json
import pathlib
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', required=True)
parser.add_argument('--env-file', required=True)
parser.add_argument('--container', help='Disposable local Nextcloud container; enables group-policy tests and restores its app configuration')
args = parser.parse_args()
config = dict(line.split('=', 1) for line in pathlib.Path(args.env_file).read_text().splitlines() if '=' in line)
admin = (config['NEXTCLOUD_ADMIN_USER'], config['NEXTCLOUD_ADMIN_PASSWORD'])
base = args.base_url.rstrip('/')


def occ(*command):
    return subprocess.check_output(['docker', '--host=unix:///var/run/docker.sock', 'exec', '-u', 'www-data', args.container, 'php', 'occ', *command], text=True).strip()




def refresh_web_cache():
    # CLI activation cannot invalidate an already-running web worker's APCu.
    # Restart only the explicitly selected disposable development container.
    subprocess.check_call(['docker', '--host=unix:///var/run/docker.sock', 'restart', args.container], stdout=subprocess.DEVNULL)
    for attempt in range(60):
        try:
            with urllib.request.urlopen(base + '/status.php', timeout=2) as response:
                if json.load(response).get('installed'):
                    return
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    raise RuntimeError('Disposable Nextcloud did not restart')


with urllib.request.urlopen(base + '/status.php', timeout=30) as response:
    state = json.load(response)
assert state.get('installed') and not state.get('maintenance') and not state.get('needsDbUpgrade'), 'Nextcloud requires installation or upgrade'
original_enabled = occ('config:app:get', 'accessaudit', 'enabled') if args.container else None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect)



def request(path, auth=admin, method='GET', form=None, xml=None):
    headers = {'OCS-APIRequest': 'true', 'Accept': 'application/json'}
    if auth:
        headers['Authorization'] = 'Basic ' + base64.b64encode((':'.join(auth)).encode()).decode()
    data = urllib.parse.urlencode(form).encode() if form is not None else None
    if xml:
        data = xml.encode()
        headers['Content-Type'] = 'application/xml'
    req = urllib.request.Request(base + path, headers=headers, method=method, data=data)
    try:
        with opener.open(req, timeout=90) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def ocs(path, method='GET', form=None):
    code, data = request('/ocs/v2.php/' + path + '?format=json', method=method, form=form)
    assert 200 <= code < 300, (path, code)
    body = json.loads(data)
    assert body['ocs']['meta']['statuscode'] in (100, 200), body['ocs']['meta']
    return body['ocs']['data']


suffix = uuid.uuid4().hex[:10]
owner = 'audit-owner-' + suffix
recipient = 'audit-recipient-' + suffix
group = 'audit-group-' + suffix
password = secrets.token_urlsafe(32)
created = []
group_created = False
try:
    for uid in (owner, recipient):
        ocs('cloud/users', 'POST', {'userid': uid, 'password': password})
        created.append(uid)
    ocs('cloud/groups', 'POST', {'groupid': group})
    group_created = True
    ocs('cloud/users/' + recipient + '/groups', 'POST', {'groupid': group})
    dav = '/remote.php/dav/files/' + owner
    for path in ('/AuditTeam', '/AuditTeam/Nested', '/OwnerOnly'):
        assert request(dav + path, auth=(owner, password), method='MKCOL')[0] == 201
    # Shares must be created by their owner, not by the auditing administrator.
    code, data = request('/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', auth=(owner, password), method='POST', form={
        'path': '/AuditTeam', 'shareType': 1, 'shareWith': group, 'permissions': 1,
    })
    assert code == 200, code
    assert json.loads(data)['ocs']['meta']['statuscode'] in (100, 200)
    if args.container:
        occ('app:enable', 'accessaudit', '--groups=admin', '--groups=' + group)
        refresh_web_cache()
    protected = [
        '/index.php/apps/accessaudit/',
        '/index.php/apps/accessaudit/api/users/' + owner + '/folders',
        '/index.php/apps/accessaudit/api/users/' + owner,
        '/index.php/apps/accessaudit/api/groups/' + group,
        '/index.php/apps/accessaudit/api/export/users',
        '/index.php/apps/accessaudit/api/export/groups',
        '/index.php/apps/accessaudit/api/export/shares',
    ]
    for section in ('users', 'groups', 'shares'):

        endpoint = '/index.php/apps/accessaudit/api/' + section
        if section != 'shares':
            endpoint += '?limit=500&offset=0'
        assert request(endpoint)[0] == 200
        protected.append(endpoint)
    for endpoint in protected:
        code, _ = request(endpoint, auth=(recipient, password))
        assert code == 200, ('member', endpoint, code)
        assert request(endpoint, auth=None)[0] in (302, 303, 401, 403, 404, 412), ('anonymous', endpoint)
        if args.container:
            assert request(endpoint, auth=(owner, password))[0] in (401, 403, 404, 412), ('excluded', endpoint)
    if args.container:
        ocs('cloud/users/' + recipient + '/groups', 'DELETE', {'groupid': group})
        assert request('/index.php/apps/accessaudit/api/users', auth=(recipient, password))[0] in (401, 403, 404, 412)
        ocs('cloud/users/' + recipient + '/groups', 'POST', {'groupid': group})
    code, data = request('/index.php/apps/accessaudit/api/users/' + recipient + '/folders')
    result = json.loads(data)
    assert code == 200 and result['complete'], (code, result)
    assert '/AuditTeam' in result['folders'], result
    assert '/AuditTeam/Nested' in result['folders'], result
    assert '/OwnerOnly' not in result['folders'], result
    code, data = request('/index.php/apps/accessaudit/api/shares')
    assert all('token' not in share for share in json.loads(data)['shares'])
    code, data = request('/index.php/apps/accessaudit/api/export/users?columns[]=uid&columns[]=folders')
    assert code == 200 and b'AuditTeam' in data and b'email' not in data.splitlines()[0]
    assert request('/index.php/apps/accessaudit/api/export/users?columns[]=token')[0] == 400
    assert request('/index.php/apps/accessaudit/api/export/users', auth=(recipient, password))[0] == 200
    code, data = request('/index.php/apps/accessaudit/')
    assert code == 200 and b'accessaudit-export-pdf' in data
    assert request('/custom_apps/accessaudit/css/print.css')[0] == 200
    print('PASS: Nextcloud API/page, allowed groups, anonymous/excluded-user denial, real nested group-share folders, CSV selection, PDF asset, token redaction')
finally:
    if args.container and original_enabled is not None:
        if original_enabled == 'yes':
            occ('app:disable', 'accessaudit')
            occ('app:enable', 'accessaudit')
        elif original_enabled == 'no':
            occ('app:disable', 'accessaudit')
        else:
            occ('app:enable', 'accessaudit', *['--groups=' + gid for gid in json.loads(original_enabled)])
        refresh_web_cache()
    for uid in reversed(created):
        ocs('cloud/users/' + uid, 'DELETE')
    if group_created:
        ocs('cloud/groups/' + group, 'DELETE')
