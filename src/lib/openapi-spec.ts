import type { OpenAPIV3 } from './openapi-types.js';

export const openApiSpec: OpenAPIV3 = {
  openapi: '3.0.3',
  info: {
    title: 'Recruitment Agent API',
    description: `AI-powered recruitment drive creation agent. Upload job description PDFs, extract structured data via Gemini AI, and generate complete recruitment drive configurations through a conversational Q&A flow.

## Flow
1. **Create a chat** → \`POST /api/chats\`
2. **Upload JD PDF** → \`POST /api/chats/{chatId}/files\`
3. **Generate drive data** → \`POST /api/chats/{chatId}/generate\` (returns questions if data is incomplete)
4. **Submit answers** → \`POST /api/chats/{chatId}/generate\` with answers (repeat until complete)`,
    version: '1.0.0',
    contact: {
      name: 'Recruitment Agent',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Chats', description: 'Chat management' },
    { name: 'Files', description: 'File upload and listing' },
    { name: 'Generate', description: 'Drive data generation' },
    { name: 'Prediction', description: 'Campus matching and college prediction for hiring drives' },
  ],
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    service: { type: 'string', example: 'recruitment-agent' },
                    version: { type: 'string', example: '1.0.0' },
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/chats': {
      post: {
        tags: ['Chats'],
        summary: 'Create a new chat',
        operationId: 'createChat',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Chat title',
                    example: 'Software Engineer Drive 2026',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Chat created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    chat: { $ref: '#/components/schemas/Chat' },
                  },
                },
              },
            },
          },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      get: {
        tags: ['Chats'],
        summary: 'List all chats',
        operationId: 'listChats',
        responses: {
          '200': {
            description: 'List of chats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    chats: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Chat' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/chats/{chatId}': {
      get: {
        tags: ['Chats'],
        summary: 'Get chat details',
        operationId: 'getChat',
        parameters: [{ $ref: '#/components/parameters/ChatId' }],
        responses: {
          '200': {
            description: 'Chat details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    chat: { $ref: '#/components/schemas/Chat' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/chats/{chatId}/messages': {
      get: {
        tags: ['Chats'],
        summary: 'List chat messages',
        operationId: 'listMessages',
        parameters: [
          { $ref: '#/components/parameters/ChatId' },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Max messages to return',
          },
          {
            name: 'before',
            in: 'query',
            schema: { type: 'string' },
            description: 'Cursor for pagination (createdAt timestamp)',
          },
        ],
        responses: {
          '200': {
            description: 'List of messages',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ChatMessage' },
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/chats/{chatId}/files': {
      post: {
        tags: ['Files'],
        summary: 'Upload a JD file',
        description: 'Upload a Job Description PDF/DOC file. The file is stored in Firebase Storage, parsed by Gemini AI to extract structured drive data, and the parsed data is merged into the chat\'s accumulated drive data.',
        operationId: 'uploadFile',
        parameters: [{ $ref: '#/components/parameters/ChatId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF, DOC, or DOCX file',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'File uploaded and parsed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { $ref: '#/components/schemas/UploadedFile' },
                    parsedData: { $ref: '#/components/schemas/DriveData' },
                    message: { type: 'string', description: 'Summary of parsed data' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid file or missing file',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
      get: {
        tags: ['Files'],
        summary: 'List uploaded files',
        operationId: 'listFiles',
        parameters: [{ $ref: '#/components/parameters/ChatId' }],
        responses: {
          '200': {
            description: 'List of uploaded files',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    files: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/UploadedFile' },
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/chats/{chatId}/generate': {
      post: {
        tags: ['Generate'],
        summary: 'Generate drive data or get clarification questions',
        description: `Main generation endpoint. Analyzes current drive data state and either:
- Returns **questions** if required fields are missing
- Returns **final drive data** if all data is complete

Submit answers to previously asked questions by passing them in the \`answers\` field. Answers are keyed by dot-path (e.g. \`setupDetails.candidateType\`).`,
        operationId: 'generateDriveData',
        parameters: [{ $ref: '#/components/parameters/ChatId' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'Optional text message from user',
                    example: 'Generate the recruitment drive from uploaded JD',
                  },
                  answers: {
                    type: 'object',
                    description: 'Answers to clarification questions, keyed by field dot-path',
                    additionalProperties: {},
                    example: {
                      'setupDetails.candidateType': 'freshers',
                      'setupDetails.numberOfVacancies': 10,
                      'positionDetails.employmentType': 'full_time',
                      'positionDetails.salaryPackage': '8-12 LPA',
                    },
                  },
                  fileIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Additional file IDs to include in generation context',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Questions returned or drive data generated',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['questions'] },
                        summary: { type: 'string' },
                        questions: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Question' },
                        },
                        currentDriveData: { $ref: '#/components/schemas/DriveData' },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['drive_data'] },
                        driveData: { $ref: '#/components/schemas/DriveData' },
                        message: { type: 'string' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/chats/{chatId}/drive-data': {
      get: {
        tags: ['Generate'],
        summary: 'Get current drive data',
        operationId: 'getDriveData',
        parameters: [{ $ref: '#/components/parameters/ChatId' }],
        responses: {
          '200': {
            description: 'Current accumulated drive data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    driveData: { $ref: '#/components/schemas/DriveData' },
                    status: { type: 'string', enum: ['active', 'completed'] },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── College Prediction ───────────────────────────────────────────

    '/api/predict-colleges': {
      post: {
        tags: ['Prediction'],
        summary: 'Predict matching colleges',
        operationId: 'predictColleges',
        description:
          'Returns ranked college matches based on branch, job type, CTC, region, and degree constraints. Results include match probability scoring and an AI-generated strategic briefing.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PredictionConstraints' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Ranked list of matching colleges',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PredictionResponse' },
              },
            },
          },
          '400': {
            description: 'Missing required constraint fields',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },

  components: {
    parameters: {
      ChatId: {
        name: 'chatId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Chat ID',
      },
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' },
        },
      },

      Chat: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['active', 'completed'] },
          driveData: { $ref: '#/components/schemas/DriveData' },
        },
      },

      ChatMessage: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          chatId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          type: { type: 'string', enum: ['text', 'file_upload', 'questions', 'drive_data', 'answers'] },
          content: { type: 'string' },
          questions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Question' },
          },
          answers: { type: 'object', additionalProperties: {} },
          fileIds: { type: 'array', items: { type: 'string' } },
          driveData: { $ref: '#/components/schemas/DriveData' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      UploadedFile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          chatId: { type: 'string', format: 'uuid' },
          fileName: { type: 'string' },
          mimeType: { type: 'string' },
          fileSize: { type: 'number' },
          storageUrl: { type: 'string', format: 'uri' },
          parsedData: { $ref: '#/components/schemas/DriveData' },
          uploadedAt: { type: 'string', format: 'date-time' },
        },
      },

      DriveData: {
        type: 'object',
        description: 'Recruitment drive configuration data',
        properties: {
          setupDetails: {
            type: 'object',
            properties: {
              candidateType: { type: 'string', enum: ['fresh_graduates', 'experienced'] },
              positionTitle: { type: 'string', example: 'Software Engineer' },
              numberOfVacancies: { type: 'integer' },
              driveTitle: { type: 'string', example: 'Alpha Tech Campus Drive 2026' },
              preferredYearOfGraduation: { type: 'array', items: { type: 'integer' } },
              targetJoiningTimeframe: {
                type: 'object',
                properties: {
                  hasTarget: { type: 'boolean' },
                  format: { type: 'string', enum: ['date', 'month_year', 'year'] },
                  value: { type: 'string' },
                },
              },
            },
          },
          positionDetails: {
            type: 'object',
            properties: {
              employmentType: { type: 'string', enum: ['full_time', 'internship', 'full_time_internship'] },
              internshipDuration: { type: 'string', example: '6 months' },
              locationType: { type: 'array', items: { type: 'string' }, example: ['onsite', 'hybrid'] },
              locationCities: { type: 'array', items: { type: 'string' }, example: ['Bangalore', 'Gurugram'] },
              jobDescription: { type: 'string' },
              requiredSkills: { type: 'array', items: { type: 'string' } },
              goodToHaveSkills: { type: 'array', items: { type: 'string' } },
              salaryType: { type: 'string', enum: ['fixed', 'range', 'not_decided'] },
              salaryFixed: { type: 'string', example: '12 LPA' },
              salaryMin: { type: 'string', example: '8 LPA' },
              salaryMax: { type: 'string', example: '14 LPA' },
              salaryBreakdown: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    component: { type: 'string', example: 'Base Salary' },
                    value: { type: 'string', example: '80%' },
                  },
                },
              },
              probationPeriod: { type: 'string' },
              bondPeriod: { type: 'string' },
              bondAmount: { type: 'string' },
              additionalDetails: { type: 'string' },
            },
          },
          eligibilityCriteria: {
            type: 'object',
            properties: {
              eligibleCourses: { type: 'array', items: { type: 'string' } },
              academicCriteria: {
                type: 'object',
                properties: {
                  postGraduationMarks: { type: 'number' },
                  graduationMarks: { type: 'number' },
                  twelfthMarks: { type: 'number' },
                  diplomaMarks: { type: 'number' },
                  tenthMarks: { type: 'number' },
                  backpaperAllowed: { type: 'boolean' },
                  backpaperType: { type: 'string', enum: ['live', 'total'] },
                  maxBackpapers: { type: 'integer' },
                },
              },
              eligibilityDate: { type: 'string', format: 'date' },
              maxAge: { type: 'integer' },
            },
          },
          interviewConfig: {
            type: 'object',
            properties: {
              numberOfRounds: { type: 'integer' },
              rounds: {
                type: 'array',
                items: { $ref: '#/components/schemas/InterviewRound' },
              },
            },
          },
          customFields: { type: 'object', additionalProperties: {} },
        },
      },

      InterviewRound: {
        type: 'object',
        properties: {
          roundNumber: { type: 'integer' },
          roundType: { type: 'string', enum: ['online_aptitude', 'coding_assessment', 'technical_interview', 'group_discussion', 'system_design', 'managerial_interview', 'hr_interview', 'custom'] },
          roundTitle: { type: 'string', example: 'Round 1: Screening Test' },
          duration: { type: 'string', example: '60 minutes' },
          venue: { type: 'string', enum: ['online', 'onsite', 'hybrid_tbd'] },
          description: { type: 'string' },
        },
      },

      Question: {
        type: 'object',
        description: 'Clarification question for missing drive data fields',
        required: ['id', 'field', 'question', 'type', 'required'],
        properties: {
          id: { type: 'string', description: 'Unique question identifier' },
          field: { type: 'string', description: 'Dot-path to DriveData field', example: 'setupDetails.candidateType' },
          question: { type: 'string', description: 'Human-readable question text' },
          type: { type: 'string', enum: ['single_select', 'multi_select', 'text', 'number', 'date', 'toggle', 'tag_input'] },
          options: {
            type: 'array',
            items: { $ref: '#/components/schemas/QuestionOption' },
          },
          suggestedOptions: {
            type: 'array',
            items: { type: 'string' },
            description: 'AI-generated suggestions shown as chips alongside free-form input',
          },
          required: { type: 'boolean' },
          description: { type: 'string', description: 'Helper text shown below the question' },
          warning: { type: 'string', description: 'Immutability or important warning text' },
          defaultValue: {},
          validation: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              pattern: { type: 'string' },
            },
          },
        },
      },

      QuestionOption: {
        type: 'object',
        required: ['value', 'label'],
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
        },
      },

      // ── Prediction Schemas ──────────────────────────────────────────

      PredictionConstraints: {
        type: 'object',
        required: ['required_branch', 'job_type', 'ctc', 'region_query', 'required_degree'],
        properties: {
          required_branch: {
            type: 'string',
            description: 'Target branch/discipline for the drive.',
            example: 'CSE',
          },
          job_type: {
            type: 'string',
            enum: ['fresher', 'intern', 'lateral'],
            description: 'Type of job the drive is targeting.',
          },
          ctc: {
            type: 'number',
            description: 'Offered CTC in LPA.',
            example: 18.0,
            minimum: 0,
          },
          region_query: {
            type: 'string',
            description: 'Region or location keyword (supports partial match: South, Tamil, Chennai, etc.).',
            example: 'South',
          },
          required_degree: {
            type: 'string',
            description: 'Required degree type.',
            example: 'B.Tech',
          },
        },
      },

      PredictedCollege: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'IR-E-U-0456' },
          name: { type: 'string', example: 'Indian Institute of Technology Madras' },
          type: { type: 'string', enum: ['IIT', 'NIT', 'Private', 'State', 'Deemed'], example: 'IIT' },
          tier: { type: 'string', enum: ['Tier-1', 'Tier-2', 'Tier-3', 'Tier-4'], example: 'Tier-1' },
          location: {
            type: 'object',
            properties: {
              city: { type: 'string', example: 'Chennai' },
              state: { type: 'string', example: 'Tamil Nadu' },
              region: { type: 'string', example: 'South India' },
            },
          },
          degrees: { type: 'array', items: { type: 'string' }, example: ['B.Tech'] },
          branches: { type: 'array', items: { type: 'string' }, example: ['CSE', 'IT', 'ECE', 'ME', 'EE'] },
          placement: {
            type: 'object',
            properties: {
              avg_package_lpa: { type: 'number', example: 18.0 },
              highest_package_lpa: { type: 'number', example: 27.0 },
              placement_rate_percent: { type: 'number', example: 90.0 },
              top_recruiters: { type: 'array', items: { type: 'string' } },
            },
          },
          drive_support: {
            type: 'object',
            properties: {
              fresher: { type: 'boolean' },
              intern: { type: 'boolean' },
              lateral: { type: 'boolean' },
            },
          },
          student_strength: {
            type: 'object',
            properties: {
              total_students: { type: 'integer', example: 1000 },
              eligible_per_year: { type: 'integer', example: 250 },
            },
          },
          accreditation: { type: 'string', example: 'NBA' },
          website: { type: 'string' },
          match_probability: {
            type: 'number',
            description: 'Composite match score (0–100) based on budget fit and placement rate.',
            example: 96.0,
          },
          category: {
            type: 'string',
            enum: ['High-Yield Tier', 'Balanced Tier', 'Reach Tier (Budget Deficit)'],
            description: 'Drive-fit categorization based on scoring thresholds.',
          },
          ai_strategic_briefing: {
            type: 'string',
            description: 'AI-generated strategic recommendation for the matched campus set.',
          },
        },
      },

      PredictionResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          total_campuses_found: { type: 'integer', example: 137 },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/PredictedCollege' },
          },
        },
      },
    },
  },
};
