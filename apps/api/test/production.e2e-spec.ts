import axios from 'axios';

/**
 * Production API Integration Tests
 * Tests the full shield/transfer/unshield workflow against the production API
 * 
 * Run with: yarn test:e2e:prod
 */

const API_URL = process.env.API_URL || 'https://noirwireapi-production.up.railway.app';
const TIMEOUT = 60000; // 60 seconds for proof generation

interface ProveResponse {
  proofBase64: string;
  publicSignals: string[];
  verified: boolean;
  verificationTime: number;
}

describe('Production API Integration Tests', () => {
  const client = axios.create({
    baseURL: API_URL,
    timeout: TIMEOUT,
  });

  describe('Health Checks', () => {
    test('API should be accessible', async () => {
      const response = await client.get('/');
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    }, TIMEOUT);

    test('Indexer should be initialized', async () => {
      const response = await client.get('/indexer/status');
      expect(response.status).toBe(200);
      expect(response.data.initialized).toBe(true);
    }, TIMEOUT);
  });

  describe('Proof Generation - Shield Circuit', () => {
    const shieldInput = {
      recipient_pk: '59264660697036113640088030966259654084179245261960373491892606101637490209580',
      amount: '50000000',
      blinding: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
    };

    test('should generate valid shield proof', async () => {
      const response = await client.post<ProveResponse>('/proof/generate', {
        circuit: 'shield',
        input: shieldInput,
      });

      expect(response.status).toBe(201);
      expect(response.data.proofBase64).toBeDefined();
      expect(response.data.publicSignals).toBeDefined();
      expect(response.data.verified).toBe(true);
      expect(response.data.verificationTime).toBeGreaterThan(0);

      // Verify proof format
      expect(Buffer.from(response.data.proofBase64, 'base64').length).toBe(256);
      expect(Array.isArray(response.data.publicSignals)).toBe(true);
      expect(response.data.publicSignals.length).toBe(1); // commitment
    }, TIMEOUT);

    test('should verify generated shield proof', async () => {
      const generateResponse = await client.post<ProveResponse>('/proof/generate', {
        circuit: 'shield',
        input: shieldInput,
      });

      const verifyResponse = await client.post('/proof/verify', {
        circuit: 'shield',
        proof: generateResponse.data.proofBase64,
        publicSignals: generateResponse.data.publicSignals,
      });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.data.valid).toBe(true);
      expect(verifyResponse.data.timing.verificationMs).toBeGreaterThan(0);
    }, TIMEOUT);
  });

  describe('Proof Generation - Transfer Circuit', () => {
    const transferInput = {
      root: '18486215869881261834859254701933699535892369815372387261357405187215934509219',
      nullifier: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
      recipient_pk: '59264660697036113640088030966259654084179245261960373491892606101637490209580',
      fee: '10000',
      blinding: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
      path_index: [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
      path_elements: Array(20)
        .fill(null)
        .map(
          (_, i) => `${i}`,
        ),
    };

    test('should generate valid transfer proof', async () => {
      const response = await client.post<ProveResponse>('/proof/generate', {
        circuit: 'transfer',
        input: transferInput,
      });

      expect(response.status).toBe(201);
      expect(response.data.proofBase64).toBeDefined();
      expect(response.data.publicSignals).toBeDefined();
      expect(response.data.verified).toBe(true);

      // Verify public signals format (4 signals for transfer)
      expect(response.data.publicSignals.length).toBe(4);
    }, TIMEOUT);
  });

  describe('Proof Generation - Unshield Circuit', () => {
    const unshieldInput = {
      root: '18486215869881261834859254701933699535892369815372387261357405187215934509219',
      nullifier: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
      recipient_lo: '12345',
      recipient_hi: '67890',
      amount: '50000000',
      fee: '10000',
      blinding: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
      path_index: [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
      path_elements: Array(20)
        .fill(null)
        .map(
          (_, i) => `${i}`,
        ),
    };

    test('should generate valid unshield proof', async () => {
      const response = await client.post<ProveResponse>('/proof/generate', {
        circuit: 'unshield',
        input: unshieldInput,
      });

      expect(response.status).toBe(201);
      expect(response.data.proofBase64).toBeDefined();
      expect(response.data.publicSignals).toBeDefined();
      expect(response.data.verified).toBe(true);

      // Verify public signals format (6 signals for unshield)
      expect(response.data.publicSignals.length).toBe(6);
    }, TIMEOUT);
  });

  describe('Indexer Endpoints', () => {
    test('should get indexer status', async () => {
      const response = await client.get('/indexer/status');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('initialized');
      expect(response.data).toHaveProperty('treeLevel');
      expect(response.data).toHaveProperty('commitmentCount');
    }, TIMEOUT);

    test('should get sync status', async () => {
      const response = await client.get('/indexer/sync-status');

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    }, TIMEOUT);

    test('should get commitments for shield circuit', async () => {
      const response = await client.get('/indexer/shield/commitments');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.commitments)).toBe(true);
    }, TIMEOUT);

    test('should get root for shield circuit', async () => {
      const response = await client.get('/indexer/shield/root');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('root');
      expect(response.data).toHaveProperty('treeLevel');
      expect(response.data).toHaveProperty('size');
    }, TIMEOUT);
  });

  describe('Error Handling', () => {
    test('should handle invalid circuit type', async () => {
      try {
        await client.post('/proof/generate', {
          circuit: 'invalid_circuit',
          input: {},
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
      }
    }, TIMEOUT);

    test('should handle missing input parameters', async () => {
      try {
        await client.post('/proof/generate', {
          circuit: 'shield',
          input: {}, // Missing required fields
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    }, TIMEOUT);

    test('should handle invalid proof verification', async () => {
      const response = await client.post('/proof/verify', {
        circuit: 'shield',
        proof: Buffer.alloc(256).toString('base64'), // Invalid proof
        publicSignals: ['123'],
      });

      expect(response.status).toBe(200);
      expect(response.data.valid).toBe(false);
    }, TIMEOUT);
  });

  describe('Performance Metrics', () => {
    test('proof generation should complete within timeout', async () => {
      const startTime = Date.now();

      const response = await client.post<ProveResponse>('/proof/generate', {
        circuit: 'shield',
        input: {
          recipient_pk: '59264660697036113640088030966259654084179245261960373491892606101637490209580',
          amount: '50000000',
          blinding: '11253517972813865662223499450913129920158603553940608387241025297299931119999',
        },
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(TIMEOUT);
      expect(response.data.verificationTime).toBeGreaterThan(0);

      console.log(`✅ Proof generation took ${duration}ms (verification: ${response.data.verificationTime}ms)`);
    }, TIMEOUT);
  });

  describe('CORS Configuration', () => {
    test('should have correct CORS headers', async () => {
      const response = await client.get('/');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      // Verify it allows the expected origins
      const allowedOrigin = response.headers['access-control-allow-origin'];
      expect(['*', 'https://noirwire.com', 'https://www.noirwire.com'].includes(allowedOrigin)).toBe(true);
    }, TIMEOUT);
  });

  describe('CRUD Operations - Links', () => {
    test('should create a new link', async () => {
      const response = await client.post('/links', {
        address: 'https://example.com/target',
        metadata: 'Test link metadata',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.address).toBe('https://example.com/target');
    }, TIMEOUT);

    test('should retrieve all links', async () => {
      const response = await client.get('/links');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    }, TIMEOUT);
  });
});

