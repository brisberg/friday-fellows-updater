/**
 * Set of type interfaces for storing and interacting with spreadsheets data.
 */

export interface SpreadsheetModel {
  spreadsheetId: string;
  title: string;
  sheets: WorksheetModel[];
}

export interface WorksheetModel {
  sheetId: number;
  title: string;
  gridProperties: {rowCount?: number; columnCount?: number;};
  data: WorksheetRowModel[];
}

export interface WorksheetRowModel {
  cells: string[];
}
