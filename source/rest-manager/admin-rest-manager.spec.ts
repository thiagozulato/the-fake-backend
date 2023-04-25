import express from 'express';
import request from 'supertest';
import { RouteManager } from '../routes';
import { OverrideManager } from '../overrides';
import { RouteProperties, ServerOptions } from '../interfaces';
import { MethodType } from '../enums';
import { AdminRestManager } from './admin-rest-manager';
import { ThrottlingManager } from '../throttling';

const app = express();

const routes: RouteProperties[] = [
  {
    path: '/users',
    methods: [
      {
        type: MethodType.GET,
        data: ['First user'],
        overrides: [
          {
            name: 'Inactive User',
            data: {
              active: false,
            },
          },
        ],
      },
    ],
  },
  { path: '/dogs', methods: [{ type: MethodType.GET }] },
];

const serverOptions: ServerOptions = {
  throttlings: [
    { name: 'Fast', values: [0, 500] },
    { name: 'Medium', values: [500, 1500] },
    { name: 'Slow', values: [1500, 3000] },
    { name: 'Slowest', values: [3000, 6000] },
  ],
  proxies: [
    {
      name: 'sandbox',
      host: 'https://sandbox.com',
    },
    {
      name: 'production',
      host: 'https://production.com',
    },
  ],
};

describe('source/rest-manager/admin-rest-manager.ts', () => {
  const routeManager = new RouteManager();
  const overrideManager = new OverrideManager(routeManager);
  const throttlingManager = new ThrottlingManager(serverOptions.throttlings);
  const adminRestManager = new AdminRestManager(
    serverOptions,
    routeManager,
    overrideManager,
    throttlingManager
  );

  adminRestManager.build(app);

  beforeEach(() => {
    routeManager.setAll(routes);
  });

  describe('GET /admin/routes', () => {
    it('get all routes', async () => {
      const { statusCode, body } = await request(app).get('/admin/routes');

      expect(statusCode).toBe(200);
      expect(body).toEqual([
        {
          methods: [
            {
              data: ['First user'],
              type: 'get',
              overrides: [
                {
                  name: 'Inactive User',
                  data: {
                    active: false,
                  },
                },
              ],
            },
          ],
          path: '/users',
        },
        {
          methods: [{ type: 'get' }],
          path: '/dogs',
        },
      ]);
    });

    it('get route by path', async () => {
      const { statusCode, body } = await request(app).get(
        '/admin/routes?path=/dogs'
      );

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(1);
      expect(body).toEqual([
        {
          methods: [{ type: 'get' }],
          path: '/dogs',
        },
      ]);
    });

    it('returns response error when the route is not found', async () => {
      const { statusCode, body } = await request(app).get(
        '/admin/routes?path=/dogs-teste'
      );

      expect(statusCode).toBe(400);
      expect(body).toEqual({
        message: expect.any(String),
      });
    });
  });

  describe('GET /admin/routes/content', () => {
    it('returns path content without override', async () => {
      const { statusCode, body } = await request(app).get(
        '/admin/routes/content?path=/users&type=get'
      );

      expect(statusCode).toBe(200);
      expect(body).toEqual(routes[0].methods[0].data);
    });

    it('returns path content with override', async () => {
      const { statusCode, body } = await request(app).get(
        '/admin/routes/content?path=/users&type=get&overrideName=Inactive User'
      );

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        active: false,
      });
    });

    it('returns generic message when data or file is a function', async () => {
      routeManager.setAll([
        {
          methods: [
            {
              type: 'get',
              overrides: [
                {
                  name: 'Inactive User',
                  data: jest.fn(),
                },
              ],
            },
          ],
          path: '/users',
        },
      ]);

      const { statusCode, body } = await request(app).get(
        '/admin/routes/content?path=/users&type=get&overrideName=Inactive User'
      );

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        message: expect.any(String),
      });
    });

    it('returns response error when the route is not found', async () => {
      const { statusCode, body } = await request(app).get(
        '/admin/routes/content?path=/invalid-path&type=get&overrideName=Inactive User'
      );

      expect(statusCode).toBe(400);
      expect(body).toEqual({
        message: expect.any(String),
      });
    });
  });

  describe('POST /admin/routes/use-override', () => {
    const USE_OVERRIDE_ROUTE = '/admin/routes/use-override';

    it('should change a route method override', async () => {
      const overrideData = {
        path: '/users',
        type: 'get',
        name: 'Inactive User',
      };

      const { statusCode, body } = await request(app)
        .post(USE_OVERRIDE_ROUTE)
        .send(overrideData);

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        name: 'Inactive User',
        routePath: '/users',
        methodType: 'get',
      });
    });

    it('returns response error when the route is invalid', async () => {
      const { statusCode, body } = await request(app)
        .post(USE_OVERRIDE_ROUTE)
        .send({ path: '/invalid-path' });

      expect(statusCode).toBe(400);
      expect(body).toEqual({
        message: expect.any(String),
      });
    });
  });

  describe('GET /admin/config', () => {
    it('returns the ServerOptions config', async () => {
      const { statusCode, body } = await request(app).get('/admin/config');

      expect(statusCode).toBe(200);
      expect(body).toEqual(serverOptions);
    });
  });

  describe('POST /admin/routes/use-throttling', () => {
    const USE_THROTTLING_ROUTE = '/admin/routes/use-throttling';

    it('should select the throttling for all endpoints', async () => {
      const { statusCode } = await request(app)
        .post(USE_THROTTLING_ROUTE)
        .send({
          name: 'Slow',
        });

      expect(statusCode).toBe(204);
      expect(throttlingManager.getCurrent()).toEqual(
        serverOptions.throttlings[2]
      );
    });

    it('should turn off throttling if the option doesnt exist', async () => {
      const { statusCode } = await request(app)
        .post(USE_THROTTLING_ROUTE)
        .send({
          name: '',
        });

      expect(statusCode).toBe(204);
      expect(throttlingManager.getCurrent()).toBeNull();
    });
  });
});
