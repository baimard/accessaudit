"""Exercise an explicitly selected disposable Nextcloud instance (stdlib only).

Creates uniquely named test users/group and removes them in finally.
Credentials are read from a local env file; never passed in command arguments.
"""
import argparse
import base64
import json
import pathlib
import secrets
import urllib.error
import urllib.parse
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', required=True)
parser.add_argument('--env-file', required=True)
args = parser.parse_args()
config = dict(line.split('=', 1) for line in pathlib.Path(args.env_file).read_text().splitlines() if '=' in line)
admin = (config['NEXTCLOUD_ADMIN_USER'], config['NEXTCLOUD_ADMIN_PASSWORD'])
base = args.base_url.rstrip('/')


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
        with urllib.request.urlopen(req, timeout=90) as response:
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
    for section in ('users', 'groups', 'shares'):
        endpoint = '/index.php/apps/accessaudit/api/' + section
        assert request(endpoint)[0] == 200
        assert request(endpoint, auth=(recipient, password))[0] == 403
    assert request('/index.php/apps/accessaudit/', auth=(recipient, password))[0] == 403
    assert request('/index.php/apps/accessaudit/api/users/' + owner + '/folders', auth=(recipient, password))[0] == 403
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
    assert request('/index.php/apps/accessaudit/api/export/users', auth=(recipient, password))[0] == 403
    code, data = request('/index.php/apps/accessaudit/')
    assert code == 200 and b'accessaudit-export-pdf' in data
    assert request('/custom_apps/accessaudit/css/print.css')[0] == 200
    print('PASS: Nextcloud API/page, admin guards, real nested group-share folders, CSV selection, PDF asset, token redaction')
finally:
    for uid in reversed(created):
        ocs('cloud/users/' + uid, 'DELETE')
    if group_created:
        ocs('cloud/groups/' + group, 'DELETE')
