/**
 * documents.service — integration tests with mocked Supabase
 *
 * Verifies that the real service functions:
 *  - getDocumentsForLoad() returns DocumentRow arrays, empty arrays, and throws on error
 *  - uploadDocument() calls storage.upload(), resolves the public URL, then inserts the row
 *  - uploadDocument() propagates storage errors before touching the DB
 *  - uploadDocument() propagates DB insert errors
 *  - The inserted row includes correct metadata (filename, size, mime type, type)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getDocumentsForLoad, uploadDocument } from '@/services/documents.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => {
  const storageBuilder = {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    createSignedUrl: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(),
      storage: { from: vi.fn().mockReturnValue(storageBuilder) },
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilder(result: unknown) {
  const self: Record<string, unknown> = {};
  for (const m of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ]) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.then = (onfulfilled: (v: unknown) => unknown, onrejected: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onfulfilled, onrejected);
  return self;
}

const RAW_DOC = {
  id: 'doc-1',
  load_id: 'load-1',
  company_id: 'co-1',
  uploaded_by: 'user-1',
  type: 'bill_of_lading',
  file_name: 'bol.pdf',
  file_url: 'https://cdn.example.com/documents/load-1/bill_of_lading-123.pdf',
  file_size_bytes: 204800,
  mime_type: 'application/pdf',
  created_at: '2026-03-01T00:00:00Z',
};

const mockFrom = vi.mocked(supabase.from);
const mockStorageFrom = vi.mocked(supabase.storage.from);

function storageOps() {
  return mockStorageFrom.mock.results[mockStorageFrom.mock.results.length - 1]?.value as ReturnType<
    typeof mockStorageFrom
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset storage mock to a fresh object each test
  mockStorageFrom.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/documents/load-1/bill_of_lading-123.pdf' },
    }),
    createSignedUrl: vi.fn(),
  } as never);
});

// ---------------------------------------------------------------------------
// getDocumentsForLoad
// ---------------------------------------------------------------------------

describe('getDocumentsForLoad', () => {
  it('returns an array of DocumentRow objects', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [RAW_DOC], error: null }) as never);
    const docs = await getDocumentsForLoad('load-1');
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc-1');
    expect(docs[0].type).toBe('bill_of_lading');
    expect(docs[0].file_name).toBe('bol.pdf');
  });

  it('returns an empty array when no documents exist', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }) as never);
    expect(await getDocumentsForLoad('load-1')).toEqual([]);
  });

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'permission denied' } }) as never,
    );
    await expect(getDocumentsForLoad('load-1')).rejects.toThrow('permission denied');
  });
});

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

function makeFile(name = 'bol.pdf', size = 204800, type = 'application/pdf'): File {
  // Build a plain-object File stand-in — Node's Blob.size is read-only,
  // so we can't assign it via Object.assign on a real Blob.
  return {
    name,
    size,
    type,
    lastModified: Date.now(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    slice: () => new Blob(),
    stream: () => new ReadableStream(),
    text: () => Promise.resolve(''),
  } as unknown as File;
}

describe('uploadDocument', () => {
  it('returns the inserted DocumentRow on success', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_DOC, error: null }) as never);

    const doc = await uploadDocument({
      loadId: 'load-1',
      uploadedBy: 'user-1',
      companyId: 'co-1',
      type: 'bill_of_lading',
      file: makeFile(),
    });

    expect(doc.id).toBe('doc-1');
    expect(doc.type).toBe('bill_of_lading');
  });

  it('uploads file to the "documents" storage bucket', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: RAW_DOC, error: null }) as never);

    await uploadDocument({
      loadId: 'load-1',
      uploadedBy: 'user-1',
      companyId: null,
      type: 'bill_of_lading',
      file: makeFile(),
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('documents');
    const ops = storageOps() as { upload: ReturnType<typeof vi.fn> };
    expect(ops.upload).toHaveBeenCalledWith(
      expect.stringContaining('load-1/bill_of_lading-'),
      expect.any(Object),
      expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
    );
  });

  it('inserts the DB row with correct metadata', async () => {
    const dbBuilder = makeBuilder({ data: RAW_DOC, error: null });
    mockFrom.mockReturnValue(dbBuilder as never);

    await uploadDocument({
      loadId: 'load-1',
      uploadedBy: 'user-1',
      companyId: 'co-1',
      type: 'proof_of_delivery',
      file: makeFile('pod.pdf', 512000),
    });

    expect(dbBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        load_id: 'load-1',
        uploaded_by: 'user-1',
        company_id: 'co-1',
        type: 'proof_of_delivery',
        file_name: 'pod.pdf',
        file_size: 512000,
      }),
    );
  });

  it('throws when the storage upload fails (before touching the DB)', async () => {
    // Override storage mock to fail
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'bucket not found' } }),
      getPublicUrl: vi.fn(),
    } as never);

    await expect(
      uploadDocument({
        loadId: 'load-1',
        uploadedBy: 'user-1',
        companyId: null,
        type: 'bill_of_lading',
        file: makeFile(),
      }),
    ).rejects.toThrow('bucket not found');

    // DB should not be touched
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when the DB insert fails after a successful storage upload', async () => {
    mockFrom.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'insert error' } }) as never,
    );

    await expect(
      uploadDocument({
        loadId: 'load-1',
        uploadedBy: 'user-1',
        companyId: null,
        type: 'bill_of_lading',
        file: makeFile(),
      }),
    ).rejects.toThrow('insert error');
  });
});
