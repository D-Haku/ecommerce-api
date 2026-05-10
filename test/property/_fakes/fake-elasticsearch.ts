// A minimal in-memory fake for the subset of the @elastic/elasticsearch
// Client used by src/ingest/elasticsearch.ts.

type Doc = Record<string, unknown>;

export class FakeEsClient {
  public indexExists = false;
  public createdIndexBody: Record<string, unknown> | null = null;
  public documents: Map<string, Doc> = new Map();

  public indices = {
    exists: async ({ index: _index }: { index: string }) => {
      void _index;
      return this.indexExists;
    },
    create: async (arg: {
      index: string;
      settings?: Record<string, unknown>;
      mappings?: Record<string, unknown>;
    }) => {
      this.indexExists = true;
      this.createdIndexBody = {
        settings: arg.settings,
        mappings: arg.mappings,
      };
      return { acknowledged: true };
    },
  };

  async bulk(arg: {
    refresh?: boolean | string;
    operations: Array<Record<string, unknown>>;
  }): Promise<{ errors: boolean; items: Array<Record<string, unknown>> }> {
    const ops = arg.operations;
    const items: Array<Record<string, unknown>> = [];
    for (let i = 0; i < ops.length; i += 2) {
      const envelope = ops[i] as { index?: { _index: string; _id: string } };
      const doc = ops[i + 1] as Doc;
      if (envelope?.index) {
        this.documents.set(envelope.index._id, doc);
        items.push({
          index: {
            _index: envelope.index._index,
            _id: envelope.index._id,
            status: 200,
          },
        });
      }
    }
    return { errors: false, items };
  }

  async search(arg: {
    index: string;
    from?: number;
    size?: number;
    query?: unknown;
  }): Promise<{
    hits: { total: { value: number }; hits: Array<Record<string, unknown>> };
  }> {
    // Naive: return all docs paginated by from/size. Score is deterministic
    // based on insertion order (1, 0.9, 0.8, ...).
    const all = Array.from(this.documents.values());
    const from = arg.from ?? 0;
    const size = arg.size ?? all.length;
    const slice = all.slice(from, from + size).map((doc, idx) => ({
      _id: String(doc.id),
      _score: Math.max(0, 1 - idx * 0.1),
      _source: doc,
    }));
    return {
      hits: {
        total: { value: all.length },
        hits: slice,
      },
    };
  }

  async close(): Promise<void> {
    // no-op
  }

  snapshotDocuments(): Array<[string, Doc]> {
    return Array.from(this.documents.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }
}
