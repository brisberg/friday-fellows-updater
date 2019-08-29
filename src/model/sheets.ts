/**
 * Set of type interfaces for storing and interacting with spreadsheets data.
 */

export interface SpeadsheetModel {
  spreadsheetId: string;
  title: string;
  worksheets: WorksheetModel[];
}

export interface WorksheetModel {
  sheetId: number;
  title: string;
  gridProperties: {rowCount: number; columnCount: number;};
  data: WorksheetRowModel[];
}

export interface WorksheetRowModel {
  cells: string[];
}