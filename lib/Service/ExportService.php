<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

/** @psalm-api */
class ExportService {
	/** @param list<array<string, mixed>> $rows */
	public function toJson(array $rows): string {
		return json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
	}

	/**
	 * @param list<array<string, mixed>> $rows
	 * @param array<array-key, mixed> $columns Empty selects all available columns.
	 */
	public function toCsv(array $rows, array $columns = []): string {
		if ($rows === []) {
			return '';
		}
		$selected = [];
		foreach ($columns as $column) {
			if (!is_string($column)) {
				throw new \InvalidArgumentException('Invalid export column');
			}
			$selected[] = $column;
		}
		$available = array_keys($rows[0]);
		$headers = $selected === [] ? $available : array_values(array_unique($selected));
		foreach ($headers as $header) {
			if (!in_array($header, $available, true)) {
				throw new \InvalidArgumentException('Unknown export column');
			}
		}
		$stream = fopen('php://temp', 'r+');
		if ($stream === false) {
			throw new \RuntimeException('Unable to create export stream');
		}
		try {
			fputcsv($stream, $headers, ';', '"', '');
			foreach ($rows as $row) {
				$values = [];
				foreach ($headers as $header) {
					/** @var mixed $value */
					$value = $row[$header] ?? null;
					$text = is_array($value)
						? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
						: (string)$value;
					// Quoting alone does not prevent spreadsheet formula execution.
					if (preg_match('/^[\s\x{FEFF}]*[=+@-]|^[\t\r\n]/u', $text) === 1) {
						$text = "'" . $text;
					}
					$values[] = $text;
				}
				fputcsv($stream, $values, ';', '"', '');
			}
			rewind($stream);
			$content = stream_get_contents($stream);
			return $content === false ? '' : "\xEF\xBB\xBF" . $content;
		} finally {
			fclose($stream);
		}
	}
}
