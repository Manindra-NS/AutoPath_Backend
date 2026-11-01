import swaggerUi from 'swagger-ui-express';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AutoPath Backend REST API',
    version: '1.0.0',
    description: `
**AutoPath** is a comprehensive transit discovery platform for Kolkata's shared auto-rickshaw network.
This API provides access to registered auto stands, fixed fare structures, intermediate boarding/alighting stops,
and exact road-following polyline coordinates.

### Key Architectural Notes:
- **Zero Coordinate Distortion**: All road coordinates and sequence numbers are preserved exactly as provided by the administration.
- **Dual Support**: GeoJSON \`[longitude, latitude]\` and Leaflet \`[latitude, longitude]\` coordinate ordering are both provided.
- **Dual Endpoint Mounting**: Both \`/api/stops\` and \`/api/stands\` are supported for seamless frontend integration.
    `,
    contact: {
      name: 'AutoPath Support',
      email: 'support@autopath.kolkata.in'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from POST /api/admin/auth/login'
      }
    },
    schemas: {
      Stop: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ruby-more' },
          name: { type: 'string', example: 'Ruby More' },
          bengaliName: { type: 'string', example: 'রুবি মোড়' },
          fullName: { type: 'string', example: 'Ruby More Auto Stand' },
          latitude: { type: 'number', example: 22.5134 },
          longitude: { type: 'number', example: 88.3995 },
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            example: [22.5134, 88.3995]
          },
          coordsDescription: { type: 'string', example: 'EM Bypass & Rashbehari Conn.' },
          serviceSpan: { type: 'string', example: '05:30 AM – Midnight' },
          tier: { type: 'string', example: 'TIER-1 INTERCHANGE HUB' },
          isStand: { type: 'boolean', example: true }
        }
      },
      Route: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ruby-gariahat' },
          code: { type: 'string', example: 'AK-14' },
          name: { type: 'string', example: 'Ruby More ⇄ Gariahat' },
          bengaliName: { type: 'string', example: 'রুবি মোড় ⇄ গড়িয়াহাট' },
          originStandId: { type: 'string', example: 'ruby-more' },
          destinationStandId: { type: 'string', example: 'gariahat' },
          fareRange: { type: 'string', example: '₹12 - ₹15' },
          fareFixed: { type: 'string', example: '₹16.00 Fixed' },
          distance: { type: 'string', example: '~4.2 km' },
          estTravelMin: { type: 'integer', example: 18 },
          hasValidGeometry: { type: 'boolean', example: true },
          pathCoordinates: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' }
            },
            example: [[22.5134, 88.3995], [22.5150, 88.3910], [22.5190, 88.3645]]
          }
        }
      },
      RouteGeometry: {
        type: 'object',
        properties: {
          route_id: { type: 'string', example: 'ruby-gariahat' },
          route_name: { type: 'string', example: 'Ruby More ⇄ Gariahat' },
          source: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'ruby-more' },
              name: { type: 'string', example: 'Ruby More' },
              latitude: { type: 'number', example: 22.5134 },
              longitude: { type: 'number', example: 88.3995 }
            }
          },
          destination: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'gariahat' },
              name: { type: 'string', example: 'Gariahat' },
              latitude: { type: 'number', example: 22.5190 },
              longitude: { type: 'number', example: 88.3645 }
            }
          },
          intermediate_points: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sequence: { type: 'integer', example: 1 },
                latitude: { type: 'number', example: 22.5150 },
                longitude: { type: 'number', example: 88.3910 }
              }
            }
          },
          geometry: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'LineString' },
              coordinates: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'number' }
                },
                example: [[88.3995, 22.5134], [88.3910, 22.5150], [88.3645, 22.5190]]
              }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Detailed error message' },
          message: { type: 'string', example: 'Detailed error message' }
        }
      }
    }
  },
  paths: {
    '/stops': {
      get: {
        tags: ['Stops & Stands'],
        summary: 'List all active auto stands and stops',
        responses: {
          200: {
            description: 'List of active auto stands',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 6 },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Stop' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/stops/{id}': {
      get: {
        tags: ['Stops & Stands'],
        summary: 'Get details for a specific auto stand',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ruby-more' }
        ],
        responses: {
          200: { description: 'Stop details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Stop' } } } },
          404: { description: 'Stop not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/stops/{id}/routes': {
      get: {
        tags: ['Stops & Stands'],
        summary: 'List all active auto corridors departing from a specific stand',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ruby-more' }
        ],
        responses: {
          200: { description: 'List of routes originating from this stand' }
        }
      }
    },
    '/routes': {
      get: {
        tags: ['Routes'],
        summary: 'List all active auto routes',
        responses: {
          200: { description: 'List of routes' }
        }
      }
    },
    '/routes/search': {
      get: {
        tags: ['Routes'],
        summary: 'Search routes between two locations or stands',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string' }, example: 'Ruby More' },
          { name: 'to', in: 'query', schema: { type: 'string' }, example: 'Gariahat' }
        ],
        responses: {
          200: { description: 'Search results matching origin and destination' }
        }
      }
    },
    '/routes/{id}': {
      get: {
        tags: ['Routes'],
        summary: 'Get full route details with road geometry and intermediate stops',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ruby-gariahat' }
        ],
        responses: {
          200: { description: 'Complete route details' },
          404: { description: 'Route not found' }
        }
      }
    },
    '/routes/{id}/geometry': {
      get: {
        tags: ['Routes'],
        summary: 'Get route geometry in GeoJSON and Leaflet formats with ordered coordinates',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ruby-gariahat' }
        ],
        responses: {
          200: {
            description: 'Route geometry strictly ordered by sequence',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RouteGeometry' } } }
          }
        }
      }
    },
    '/routes/{id}/stops': {
      get: {
        tags: ['Routes'],
        summary: 'Get ordered intermediate boarding and drop-off stops along a route',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'ruby-gariahat' }
        ],
        responses: {
          200: { description: 'List of ordered intermediate stops' }
        }
      }
    },
    '/locations/search': {
      get: {
        tags: ['Locations'],
        summary: 'Autocomplete search for locations and stands',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, example: 'Garia' }
        ],
        responses: {
          200: { description: 'Autocomplete suggestions' }
        }
      }
    },
    '/admin/auth/login': {
      post: {
        tags: ['Admin Auth'],
        summary: 'Admin login for JWT authentication token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'Admin@AutoPath2026' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful with JWT token' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/admin/routes': {
      post: {
        tags: ['Admin Routes'],
        summary: 'Create a new auto route with starting point, destination, and intermediate coordinates (Transactional)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['route_name', 'source_stop_id', 'destination_stop_id'],
                properties: {
                  id: { type: 'string', example: 'ruby-chowbaga' },
                  route_name: { type: 'string', example: 'Ruby More ⇄ Chowbaga' },
                  source_stop_id: { type: 'string', example: 'ruby-more' },
                  destination_stop_id: { type: 'string', example: 'chowbaga' },
                  fare_fixed: { type: 'string', example: '₹14.00 Fixed' },
                  distance: { type: 'string', example: '~3.2 km' },
                  intermediate_points: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sequence_number: { type: 'integer', example: 1 },
                        latitude: { type: 'number', example: 22.5134 },
                        longitude: { type: 'number', example: 88.3995 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Route created successfully' }
        }
      }
    },
    '/admin/routes/{id}': {
      put: {
        tags: ['Admin Routes'],
        summary: 'Update existing route metadata and endpoints',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Route updated' } }
      },
      delete: {
        tags: ['Admin Routes'],
        summary: 'Deactivate or delete an auto route',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'permanent', in: 'query', schema: { type: 'boolean', default: false } }
        ],
        responses: { 200: { description: 'Route deactivated or deleted' } }
      }
    },
    '/admin/routes/{id}/points': {
      post: {
        tags: ['Admin Coordinates'],
        summary: 'Add intermediate coordinates to an existing route',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  points: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sequence_number: { type: 'integer' },
                        latitude: { type: 'number' },
                        longitude: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Points added successfully' } }
      },
      put: {
        tags: ['Admin Coordinates'],
        summary: 'Update or reorder all intermediate coordinates transactionally',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Points updated and reordered' } }
      }
    },
    '/admin/routes/{id}/points/{pointId}': {
      delete: {
        tags: ['Admin Coordinates'],
        summary: 'Delete a specific intermediate coordinate point',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'pointId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Point deleted' } }
      }
    }
  }
};

export const serveSwagger = swaggerUi.serve;
export const setupSwagger = swaggerUi.setup(swaggerSpec);

