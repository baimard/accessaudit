<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

class ExportService {
	/** @param list<array<string, mixed>> $rows */
	public function toJson(array $rows): string {
		return (string)json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
	}

	/** @param list<array<string, mixed>> $rows */
	public function toCsv(array $rows): string {
		if ($rows === []) {
			return '';
		}

		$stream = fopen('php://temp', 'r+');
		if ($stream === false) {
			throw new \RuntimeException('Unable to create export stream');
		}

		$headers = array_keys($rows[0]);
		fputcsv($stream, $headers, ';');
		foreach ($rows as $row) {
			$values = [];
			foreach ($headers as $header) {
				$value = $row[$header] ?? null;
				$values[] = is_array($value)
					? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
					: $value;
			}
			fputcsv($stream, $values, ';');
		}

		rewind($stream);
		$content = stream_get_contents($stream);
		fclose($stream);
		return $content === false ? '' : "\xEF\xBB\xBF" . $content;
	}
}
