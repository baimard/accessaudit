<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Tests\Service;

use OCA\AccessAudit\Service\FolderService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use PHPUnit\Framework\TestCase;

final class FolderServiceTest extends TestCase {
	public function testWalksReadableNestedMountsWithoutReadingFilesOrDeniedFolders(): void {
		$root = $this->createMock(Folder::class);
		$root->method('getPath')->willReturn('/alice/files');
		$root->method('getRelativePath')->willReturnCallback(static fn (string $path): string => substr($path, strlen('/alice/files')));
		$root->method('isReadable')->willReturn(true);
		$shared = $this->createMock(Folder::class);
		$shared->method('getPath')->willReturn('/alice/files/Shared');
		$shared->method('isReadable')->willReturn(true);
		$nested = $this->createMock(Folder::class);
		$nested->method('getPath')->willReturn('/alice/files/Shared/Nested');
		$nested->method('isReadable')->willReturn(true);
		$nested->method('getDirectoryListing')->willReturn([]);
		$shared->method('getDirectoryListing')->willReturn([$nested]);
		$denied = $this->createMock(Folder::class);
		$denied->method('getPath')->willReturn('/alice/files/Denied');
		$denied->method('isReadable')->willReturn(false);
		$denied->expects(self::never())->method('getDirectoryListing');
		$root->method('getDirectoryListing')->willReturn([$shared, $denied, $this->createMock(File::class)]);
		$filesystem = $this->createMock(IRootFolder::class);
		$filesystem->expects(self::once())->method('getUserFolder')->with('alice')->willReturn($root);
		self::assertSame(['folders' => ['/', '/Shared', '/Shared/Nested'], 'complete' => true, 'unavailable' => []], (new FolderService($filesystem))->findAll('alice'));
	}

	public function testStorageFailureIsExplicitlyIncompleteWithoutLeakingException(): void {
		$filesystem = $this->createMock(IRootFolder::class);
		$filesystem->method('getUserFolder')->willThrowException(new \RuntimeException('sensitive storage credentials'));
		self::assertSame(['folders' => [], 'complete' => false, 'unavailable' => ['/']], (new FolderService($filesystem))->findAll('alice'));
	}

	public function testUnavailableSubfolderDoesNotHideOtherResults(): void {
		$root = $this->createMock(Folder::class);
		$root->method('getPath')->willReturn('/alice/files');
		$root->method('getRelativePath')->willReturn('');
		$root->method('isReadable')->willReturn(true);
		$root->method('getDirectoryListing')->willThrowException(new \RuntimeException('offline'));
		$filesystem = $this->createMock(IRootFolder::class);
		$filesystem->method('getUserFolder')->willReturn($root);
		self::assertSame(['folders' => ['/'], 'complete' => false, 'unavailable' => ['/']], (new FolderService($filesystem))->findAll('alice'));
	}
}
