export class AleoClient {
  readonly endpoint: string;
  readonly network: string;

  constructor(endpoint: string, network: string) {
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.network = network;
  }

  async get(path: string) {
    const response = await fetch(`${this.endpoint}${path}`);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`GET ${path} failed with ${response.status}: ${text}`);
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async first(paths: string[]) {
    const errors: string[] = [];

    for (const path of paths) {
      try {
        return await this.get(path);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(errors.join("\n"));
  }

  latestHeight() {
    return this.first([
      `/${this.network}/latest/height`,
      `/${this.network}/latest/block/height`
    ]);
  }

  latestBlock() {
    return this.get(`/${this.network}/latest/block`);
  }

  block(heightOrHash: string) {
    return this.get(`/${this.network}/block/${encodeURIComponent(heightOrHash)}`);
  }

  transaction(transactionId: string) {
    return this.get(`/${this.network}/transaction/${encodeURIComponent(transactionId)}`);
  }

  program(programId: string) {
    return this.get(`/${this.network}/program/${encodeURIComponent(programId)}`);
  }

  mappings(programId: string) {
    return this.first([
      `/${this.network}/program/${encodeURIComponent(programId)}/mappings`,
      `/${this.network}/program/${encodeURIComponent(programId)}?mappings=true`
    ]);
  }

  mappingValue(programId: string, mapping: string, key: string) {
    return this.get(
      `/${this.network}/program/${encodeURIComponent(programId)}/mapping/${encodeURIComponent(mapping)}/${encodeURIComponent(key)}`
    );
  }
}
