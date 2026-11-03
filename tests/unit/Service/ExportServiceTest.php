<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Tests\Service;

use OCA\AccessAudit\Service\ExportService;
use PHPUnit\Framework\TestCase;

final class ExportServiceTest extends TestCase {
	public function testSelectedColumnsPreserveOrderAndOmitOtherData(): void {
		$csv = (new ExportService())->toCsv([['uid' => 'alice', 'email' => 'private@example.org', 'folders' => ['/Documents']]], ['folders', 'uid']);
		self::assertStringStartsWith("\xEF\xBB\xBFfolders;uid\n", $csv);
		self::assertStringContainsString('Documents', $csv);
		self::assertStringNotContainsString('private@example.org', $csv);
	}

	public function testUnknownColumnIsRejected(): void {
		$this->expectException(\InvalidArgumentException::class);
		(new ExportService())->toCsv([['uid' => 'alice']], ['token']);
	}

	public function testSpreadsheetFormulasAreNeutralizedAndQuotesRoundTrip(): void {
		$values = ['=HYPERLINK("https://example.org")', ' +123', '-1', '@SUM(1)', "\tcmd", "\rformula", "\nformula", 'Alice; "quoted"', '/Documents'];
		$csv = (new ExportService())->toCsv(array_map(static fn (string $value): array => ['uid' => $value], $values));
		$stream = fopen('php://memory', 'r+');
		self::assertIsResource($stream);
		fwrite($stream, substr($csv, 3));
		rewind($stream);
		fgetcsv($stream, 0, ';', '"', '');
		foreach ($values as $index => $value) {
			$row = fgetcsv($stream, 0, ';', '"', '');
			self::assertSame(($index < 7 ? "'" : '') . $value, $row[0]);
		}
		fclose($stream);
	}
}
