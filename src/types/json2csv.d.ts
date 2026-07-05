declare module 'json2csv' {
  export interface ParserOptions {
    fields?: Array<string | { label: string; value: string }>;
  }
  export class Parser {
    constructor(options?: ParserOptions);
    parse(data: unknown): string;
  }
}
