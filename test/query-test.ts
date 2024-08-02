import type { BaseQuad } from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import { translate } from 'sparqlalgebrajs';
import { TYPE_DEFINITION } from '../lib/constant';
import { generateQuery } from '../lib/query';
import { IStarPatternWithDependencies, Triple } from '../lib/Triple';

const DF = new DataFactory<BaseQuad>();

const RDF_STRING = DF.namedNode('http://www.w3.org/2001/XMLSchema#string');
const SNVOC_PREFIX = 'http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/';
const RDF_TYPE = TYPE_DEFINITION.value;

describe('query', () => {
  describe('generateQuery', () => {

    describe("simple queries", () => {
      it('should return the triple given a query with one triple', () => {
        const query = 'SELECT * WHERE { ?x <http://exemple.ca> ?z }';
        const resp = generateQuery(translate(query));
        expect(resp.starPatterns.size).toBe(1);
        const x = resp.starPatterns.get('x')!.starPattern;
        expect(x).toBeDefined();
        const element = x.get('http://exemple.ca')!;
        element.triple
        expect(element.triple.predicate).toBe('http://exemple.ca');
        expect((element.triple.object as any).termType).toBe('Variable');
        expect((element.triple.object as any).value).toBe('z');
      });

      it('should return the triple given a query with two triples where one triple have a dependence', () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.ca> ?z .
          ?y <http://exemple.be> ?x .
        }`;

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];
        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('x')
                    }),
                    dependencies: xStarPattern[1]
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];
        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
          yStarPattern,
        ]);

        const resp = generateQuery(translate(query));

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }

      });

      it('should return the triple given a query with nested dependence', () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.be> ?y .
          ?x <http://exemple.ca> ?w .
          ?y <http://exemple.be> ?z .
          ?z <http://exemple.be> ?w .
        }`;

        const zStarPattern: [string, IStarPatternWithDependencies] = ['z',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'z',
                    predicate: 'http://exemple.be',
                    object: DF.variable('w')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "z",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'y',
                    predicate: 'http://exemple.be',
                    object: DF.variable('z')
                  }),
                  dependencies: zStarPattern[1]
                }
              ]
            ]),
            name: "y",
            isVariable: true,

          }
        ];

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.be',
                    object: DF.variable('y')
                  }),
                  dependencies: yStarPattern[1]
                }
              ],
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('w')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
          yStarPattern,
          zStarPattern,
        ]);

        const resp = generateQuery(translate(query));

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }

      });

      it('should return the triple given a query with optional', () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.be> ?y .
          ?x <http://exemple.ca> ?w .
          ?y <http://exemple.be> ?z .
          ?z <http://exemple.be> ?w .
          OPTIONAL {
          ?xo <http://exemple.be> "1" .
          ?yo <http://exemple.be> "2" .
          } .
        }`;

        const zStarPattern: [string, IStarPatternWithDependencies] = ['z',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'z',
                    predicate: 'http://exemple.be',
                    object: DF.variable('w')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "z",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'y',
                    predicate: 'http://exemple.be',
                    object: DF.variable('z')
                  }),
                  dependencies: zStarPattern[1]
                }
              ]
            ]),
            name: "y",
            isVariable: true,

          }
        ];

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.be',
                    object: DF.variable('y')
                  }),
                  dependencies: yStarPattern[1]
                }
              ],
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('w')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternO: [string, IStarPatternWithDependencies] = ['xo',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'xo',
                    predicate: 'http://exemple.be',
                    object: DF.literal('1', RDF_STRING)
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "xo",
            isVariable: true,

          }
        ];

        const yStarPatternO: [string, IStarPatternWithDependencies] = ['yo',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'yo',
                    predicate: 'http://exemple.be',
                    object: DF.literal('2', RDF_STRING)
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "yo",
            isVariable: true,

          }
        ];
        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
          yStarPattern,
          zStarPattern,
          xStarPatternO,
          yStarPatternO
        ]);

        const resp = generateQuery(translate(query));

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }

      });

      it('should return no triple given a query with a bgp with only variable', () => {
        const query = 'SELECT * WHERE { ?x ?o ?z }';
        const resp = generateQuery(translate(query));
        expect(resp.starPatterns.size).toBe(0);
      });

      it('should returns the triples given a query with multiple triples', () => {
        const query = `SELECT * WHERE { 
                  ?x ?o ?z .
                  ?x <http://exemple.ca> ?z .
                  ?z <http://exemple.be> "abc" .
                  ?z <http://exemple.qc.ca> "abc" .
                  ?w <http://exemple.be> <http://objet.fr> .
                  <http://sujet.cm> <http://predicat.cm> "def" .
                  <http://sujet.cm> ?m "def" .
              }`;



        const zStarPattern: [string, IStarPatternWithDependencies] = [
          'z',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({ subject: 'z', predicate: 'http://exemple.be', object: DF.literal('abc', RDF_STRING) }),
                  dependencies: undefined
                }
              ],
              [
                'http://exemple.qc.ca',
                {
                  triple: new Triple({ subject: 'z', predicate: 'http://exemple.qc.ca', object: DF.literal('abc', RDF_STRING) }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "z",
            isVariable: true,

          }
        ];

        const xStarPattern: [string, IStarPatternWithDependencies] = [
          'x',
          {
            starPattern: new Map([
              ['http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: zStarPattern[1]
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const wStarPattern: [string, IStarPatternWithDependencies] = [
          'w',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({ subject: 'w', predicate: 'http://exemple.be', object: DF.namedNode('http://objet.fr') }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "w",
            isVariable: true,

          }
        ];
        const sujetStarPattern: [string, IStarPatternWithDependencies] = [
          'http://sujet.cm',
          {
            starPattern: new Map([
              ['http://predicat.cm',
                {
                  triple: new Triple({
                    subject: 'http://sujet.cm',
                    predicate: 'http://predicat.cm',
                    object: DF.literal('def', RDF_STRING),
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "http://sujet.cm",
            isVariable: false,

          }
        ];
        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
          zStarPattern,
          wStarPattern,
          sujetStarPattern
        ]);

        const resp = generateQuery(translate(query));

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
      });

      it('should return the subject group with a VALUES clause', () => {
        const query = `
        SELECT * WHERE
        {
            VALUES (?type ?person) {(UNDEF <http://exemple.be/Person>) (<http://exemple.be/Post> <http://exemple.be/Persoon>)}
  
            ?x a ?person .
            ?y <http://exemple.be> ?type .
        }
        `;

        const xStarPattern: [string, IStarPatternWithDependencies] = [
          'x',
          {
            starPattern: new Map([
              [
                RDF_TYPE,
                {
                  triple: new Triple({
                    subject: 'x', predicate: RDF_TYPE, object: [
                      DF.namedNode('http://exemple.be/Person'),
                      DF.namedNode('http://exemple.be/Persoon')
                    ]
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "x",
            isVariable: true,

          }
        ];
        const yStarPattern: [string, IStarPatternWithDependencies] = [
          'y',
          {
            starPattern: new Map([
              [
                'http://exemple.be',
                {
                  triple: new Triple({
                    subject: 'y',
                    predicate: 'http://exemple.be',
                    object: [DF.namedNode('http://exemple.be/Post')]
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "y",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, any>([
          xStarPattern,
          yStarPattern
        ]);

        const resp = generateQuery(translate(query));

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
      });
    });

    describe('query with property path', () => {
      describe('AlternativePaths', () => {
        it("should handle a simple AlternativePath", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>
            SELECT
                *
            WHERE {
                ?message snvoc:content|snvoc:imageFile ?messageContent .
                ?message snvoc:creationDate ?messageCreationDate .
            } LIMIT 10`;


          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#creationDate',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#creationDate',
                      object: DF.variable('messageCreationDate')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const contentUnionStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#content',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const imageFileUnionStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#imageFile',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#imageFile',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const expectedUnions = [
            new Map<string, any>([
              contentUnionStarPattern,
            ]),
            new Map<string, any>([
              imageFileUnionStarPattern,
            ]),
          ];

          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }

          expect(resp.union).toBeDefined();
          expect(resp.union?.length).toBe(1);

          const union = resp.union![0];
          expect(union.length).toBe(2);
          for (let i = 0; i < union.length; i++) {
            const unionQuery = union[i];
            const expectedUnion = expectedUnions[i];

            for (const [subject, starPatterns] of unionQuery.starPatterns) {
              expect(starPatterns).toStrictEqual(expectedUnion.get(subject));
            }
          }

        });

        it("should handle a star pattern with only a AlternativePath", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>
            SELECT
                *
            WHERE {
                ?message snvoc:content|snvoc:imageFile ?messageContent .
                ?messageContent snvoc:content  snvoc:content.
            } LIMIT 10`;

          const messageContentStarPattern: [string, IStarPatternWithDependencies] = [
            'messageContent',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'messageContent',
                      predicate: 'http://exemple.be#content',
                      object: DF.namedNode('http://exemple.be#content')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "messageContent",
              isVariable: true,

            }
          ];

          const unionMessageContentStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#content',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageImageFileStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#imageFile',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#imageFile',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const expectedStarPattern = new Map<string, any>([
            messageContentStarPattern
          ]);

          const expectedUnions = [
            new Map<string, any>([
              unionMessageContentStarPattern,
            ]),
            new Map<string, any>([
              unionMessageImageFileStarPattern,
            ]),
          ];

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }

          expect(resp.union).toBeDefined();
          expect(resp.union?.length).toBe(1);
          const union = resp.union![0];
          expect(union.length).toBe(2);
          for (let i = 0; i < union.length; i++) {
            const unionQuery = union[i];
            const expectedUnion = expectedUnions[i];

            for (const [subject, starPatterns] of unionQuery.starPatterns) {
              expect(starPatterns).toStrictEqual(expectedUnion.get(subject));
            }
          }
        });

        it("should handle a an AlternativePath", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>
            SELECT
                *
            WHERE {
                ?message snvoc:content|snvoc:imageFile|snvoc:bar ?messageContent .
                ?message snvoc:creationDate ?messageCreationDate .
            } LIMIT 10`;

          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#creationDate',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#creationDate',
                      object: DF.variable('messageCreationDate')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageContentStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#content',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageImageFileStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#imageFile',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#imageFile',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageBarStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#bar',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#bar',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
          ]);

          const expectedUnions = [
            new Map<string, any>([
              unionMessageContentStarPattern,
            ]),
            new Map<string, any>([
              unionMessageImageFileStarPattern,
            ]),
            new Map<string, any>([
              unionMessageBarStarPattern,
            ]),
          ];

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }

          expect(resp.union).toBeDefined();
          expect(resp.union?.length).toBe(1);
          const union = resp.union![0];
          expect(union.length).toBe(3);
          for (let i = 0; i < union.length; i++) {
            const unionQuery = union[i];
            const expectedUnion = expectedUnions[i];

            for (const [subject, starPatterns] of unionQuery.starPatterns) {
              expect(starPatterns).toStrictEqual(expectedUnion.get(subject));
            }
          }
        });

        it("should handle a multiple AlternativePaths", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>
            SELECT
                *
            WHERE {
                ?message snvoc:content|snvoc:imageFile|snvoc:bar ?messageContent .
                ?message snvoc:creationDate ?messageCreationDate .
                ?message snvoc:content|snvoc:imageFile ?somethingElse .
            } LIMIT 10`;

          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#creationDate',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#creationDate',
                      object: DF.variable('messageCreationDate')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageContentStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#content',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageImageFileStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#imageFile',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#imageFile',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageBarStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#bar',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#bar',
                      object: DF.variable('messageContent')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const union2MessageContentStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#content',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#content',
                      object: DF.variable('somethingElse')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const union2MessageImageFileStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#imageFile',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#imageFile',
                      object: DF.variable('somethingElse')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
          ]);

          const expectedUnions = [
            new Map<string, any>([
              unionMessageContentStarPattern,
            ]),
            new Map<string, any>([
              unionMessageImageFileStarPattern,
            ]),
            new Map<string, any>([
              unionMessageBarStarPattern,
            ]),
          ];

          const expectedUnions2 = [
            new Map<string, any>([
              union2MessageContentStarPattern,
            ]),
            new Map<string, any>([
              union2MessageImageFileStarPattern,
            ])
          ];

          const expectedMultipleUnions = [
            expectedUnions,
            expectedUnions2
          ];

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }

          expect(resp.union).toBeDefined();
          expect(resp.union?.length).toBe(2);
          for (let i = 0; i < resp.union!.length; i++) {
            const union = resp.union![i];
            const expectedUnions = expectedMultipleUnions[i]
            expect(union.length).toBe(expectedUnions.length);

            for (let j = 0; j < union.length; j++) {
              const unionQuery = union[j];
              const expectedUnion = expectedUnions[j];

              for (const [subject, starPatterns] of unionQuery.starPatterns) {
                expect(starPatterns).toStrictEqual(expectedUnion.get(subject));
              }
            }
          }

        });
      });

      describe("cardinality property path", () => {
        it("should handle a simple ZeroOrMorePath cardinality", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>

            SELECT
                *
            WHERE {
                ?message snvoc:id ?id .
                OPTIONAL {
                    ?message snvoc:replyOf* ?originalPostInner .
                    ?originalPostInner a snvoc:Post .
                } .
            }
            LIMIT 10`;

          const originalPostInnerPattern: [string, IStarPatternWithDependencies] = [
            'originalPostInner',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'originalPostInner',
                      predicate: RDF_TYPE,
                      object: DF.namedNode('http://exemple.be#Post')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "originalPostInner",
              isVariable: true,

            }
          ];


          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#id',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#id',
                      object: DF.variable('id')
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  'http://exemple.be#replyOf',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#replyOf',
                      object: DF.variable('originalPostInner'),
                      cardinality: { min: 0, max: -1 }
                    }),
                    dependencies: originalPostInnerPattern[1]
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];


          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
            originalPostInnerPattern
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });

        it("should handle a simple OneOrMorePath cardinality", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>

            SELECT
                *
            WHERE {
                ?message snvoc:id ?id .
                OPTIONAL {
                    ?message snvoc:replyOf+ ?originalPostInner .
                    ?originalPostInner a snvoc:Post .
                } .
            }
            LIMIT 10`;

          const originalPostInnerPattern: [string, IStarPatternWithDependencies] = [
            'originalPostInner',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'originalPostInner',
                      predicate: RDF_TYPE,
                      object: DF.namedNode('http://exemple.be#Post')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "originalPostInner",
              isVariable: true,

            }
          ];


          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#id',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#id',
                      object: DF.variable('id')
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  'http://exemple.be#replyOf',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#replyOf',
                      object: DF.variable('originalPostInner'),
                      cardinality: { min: 1, max: -1 }
                    }),
                    dependencies: originalPostInnerPattern[1]
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];


          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
            originalPostInnerPattern
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });

        it("should handle a simple ZeroOrOnePath cardinality", () => {
          const query = `
            PREFIX snvoc: <http://exemple.be#>

            SELECT
                *
            WHERE {
                ?message snvoc:id ?id .
                OPTIONAL {
                    ?message snvoc:replyOf? ?originalPostInner .
                    ?originalPostInner a snvoc:Post .
                } .
            }
            LIMIT 10`;

          const originalPostInnerPattern: [string, IStarPatternWithDependencies] = [
            'originalPostInner',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'originalPostInner',
                      predicate: RDF_TYPE,
                      object: DF.namedNode('http://exemple.be#Post')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "originalPostInner",
              isVariable: true,

            }
          ];


          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  'http://exemple.be#id',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#id',
                      object: DF.variable('id')
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  'http://exemple.be#replyOf',
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: 'http://exemple.be#replyOf',
                      object: DF.variable('originalPostInner'),
                      cardinality: { min: 0, max: 1 }
                    }),
                    dependencies: originalPostInnerPattern[1]
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];


          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
            originalPostInnerPattern
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });
      });


      describe("negated property path", () => {
        it("should handle a single negation", () => {
          const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX snvoc: <http://exemple.be#>


            SELECT
                *
            WHERE
            {
                ?message !snvoc:replyOf ?person;
            }`;

          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  Triple.NEGATIVE_PREDICATE_SET,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: Triple.NEGATIVE_PREDICATE_SET,
                      object: DF.variable('person'),
                      negatedSet: new Set(["http://exemple.be#replyOf"])
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];


          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });

        it("should handle a group negation", () => {
          const query = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX snvoc: <http://exemple.be#>


            SELECT
                *
            WHERE
            {
                ?message !(snvoc:foo|snvoc:bar|snvoc:boo) ?originalPostInner.
                ?originalPostInner a snvoc:Post .
            }`;

          const originalPostInnerPattern: [string, IStarPatternWithDependencies] = [
            'originalPostInner',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'originalPostInner',
                      predicate: RDF_TYPE,
                      object: DF.namedNode('http://exemple.be#Post')
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "originalPostInner",
              isVariable: true,

            }
          ];
          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  Triple.NEGATIVE_PREDICATE_SET,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: Triple.NEGATIVE_PREDICATE_SET,
                      object: DF.variable('originalPostInner'),
                      negatedSet: new Set([
                        "http://exemple.be#foo",
                        "http://exemple.be#bar",
                        "http://exemple.be#boo"
                      ])
                    }),
                    dependencies: originalPostInnerPattern[1]
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];


          const expectedStarPattern = new Map<string, any>([
            messageStarPattern,
            originalPostInnerPattern
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });
      });
    });

    describe('union', () => {
      it("should handle a simple union", () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.ca> ?z .
          {
            ?x <http://exemple.ca#1> ?z .
            ?x <http://exemple.ca#2> ?z .
          }UNION{
            ?x <http://exemple.ca#1> ?z .
            ?y <http://exemple.be> ?z .
          }
        }`;

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
        ]);

        const xStarPatternUnion: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
              [
                'http://exemple.ca#2',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#2',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternUnion2: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('z')
                    }),
                    dependencies: undefined
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];


        const everyExpectedStarPatternUnion = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion2,
            yStarPattern
          ])
        ];

        const resp = generateQuery(translate(query));

        expect(resp.union?.length).toBe(1);

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
        const n = (resp.union ?? []).length;
        const respUnion = resp.union![0];
        for (let i = 0; i < n; i++) {
          const union = respUnion[i];
          const expectedUnionStarPattern = everyExpectedStarPatternUnion[i];

          expect(union.starPatterns.size).toBe(expectedUnionStarPattern.size);
          expect(union.filterExpression).toBe('');
          for (const [subject, starPatterns] of union.starPatterns) {
            const expectedStarPattern = expectedUnionStarPattern.get(subject);
            expect(starPatterns).toStrictEqual(expectedStarPattern);
          }
        }
      });

      it("should handle a union with dependencies", () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.ca> ?z .
          {
            ?x <http://exemple.ca#1> ?z .
            ?x <http://exemple.ca#2> ?z .
          }UNION{
            ?x <http://exemple.ca#1> ?z .
            ?y <http://exemple.be> ?x .
          }
        }`;

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
        ]);

        const xStarPatternUnion: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
              [
                'http://exemple.ca#2',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#2',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternUnion2: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('x')
                    }),
                    dependencies: xStarPatternUnion2[1]
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];


        const everyExpectedStarPatternUnion = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion2,
            yStarPattern
          ])
        ];

        const resp = generateQuery(translate(query));

        expect(resp.union?.length).toBe(1);

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
        const n = (resp.union ?? []).length
        const respUnion = resp.union![0];
        for (let i = 0; i < n; i++) {
          const union = respUnion[i];
          const expectedUnionStarPattern = everyExpectedStarPatternUnion[i];

          expect(union.starPatterns.size).toBe(expectedUnionStarPattern.size);
          expect(union.filterExpression).toBe('');
          for (const [subject, starPatterns] of union.starPatterns) {
            const expectedStarPattern = expectedUnionStarPattern.get(subject);
            expect(starPatterns).toStrictEqual(expectedStarPattern);
          }
        }
      });

      it("should handle a multiple unions", () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.ca> ?z .
          {
            ?x <http://exemple.ca#1> ?z .
            ?x <http://exemple.ca#2> ?z .
          }UNION{
            ?x <http://exemple.ca#1> ?z .
            ?y <http://exemple.be> ?z .
          }

          {
            ?x <http://exemple.ca#1> ?z .
          }UNION{
            ?x <http://exemple.ca#1> ?z .
            ?y <http://exemple.be> ?x .
          }
        }`;

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
        ]);

        const xStarPatternUnion11: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
              [
                'http://exemple.ca#2',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#2',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternUnion12: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('z')
                    }),
                    dependencies: undefined
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];


        const everyExpectedStarPatternUnion1 = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion11,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion12,
            yStarPattern
          ])
        ];


        const xStarPatternUnion21: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];


        const yStarPatternUnion22: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('x')
                    }),
                    dependencies: xStarPatternUnion12[1]
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];


        const everyExpectedStarPatternUnion2 = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion21,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion12,
            yStarPatternUnion22
          ])
        ];

        const everyExpectedStarPatternUnionPack = [
          everyExpectedStarPatternUnion1,
          everyExpectedStarPatternUnion2
        ]

        const resp = generateQuery(translate(query));

        expect(resp.union?.length).toBe(2);

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
        const n = (resp.union ?? []).length;

        for (let i = 0; i < n; i++) {
          const respUnion = resp.union![i];
          const everyExpectedStarPatternUnion = everyExpectedStarPatternUnionPack[i];
          for (let j = 0; j < respUnion.length; j++) {
            const union = respUnion[j];
            const expectedUnionStarPattern = everyExpectedStarPatternUnion[j];

            expect(union.starPatterns.size).toBe(expectedUnionStarPattern.size);
            expect(union.filterExpression).toBe('');
            for (const [subject, starPatterns] of union.starPatterns) {
              const expectedStarPattern = expectedUnionStarPattern.get(subject);
              expect(starPatterns).toStrictEqual(expectedStarPattern);
            }
          }
        }

      });

      it("should handle nested union", () => {
        const query = `SELECT * WHERE { 
          ?x <http://exemple.ca> ?z .
          {
            ?x <http://exemple.ca#1> ?z .
            ?x <http://exemple.ca#2> ?z .
          }UNION{
            ?x <http://exemple.ca#1> ?z .
            ?y <http://exemple.be> ?z .
            {
            ?x <http://exemple.ca> ?y .
            }UNION{
              ?x <http://exemple.ca> ?w .
            }
          }
        }`;

        const xStarPattern: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
          xStarPattern,
        ]);

        const xStarPatternUnion: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
              [
                'http://exemple.ca#2',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#2',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternUnion2: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca#1',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca#1',
                    object: DF.variable('z')
                  }),
                  dependencies: undefined
                }
              ],
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const yStarPattern: [string, IStarPatternWithDependencies] = ['y',
          {
            starPattern: new Map(
              [
                ['http://exemple.be',
                  {
                    triple: new Triple({
                      subject: 'y',
                      predicate: 'http://exemple.be',
                      object: DF.variable('z')
                    }),
                    dependencies: undefined
                  }
                ]
              ]
            ),
            name: "y",
            isVariable: true,

          }
        ];

        const everyExpectedStarPatternUnion = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternUnion2,
            yStarPattern
          ])
        ];

        const xStarPatternNestedUnion1: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('y')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const xStarPatternNestedUnion2: [string, IStarPatternWithDependencies] = ['x',
          {
            starPattern: new Map([
              [
                'http://exemple.ca',
                {
                  triple: new Triple({
                    subject: 'x',
                    predicate: 'http://exemple.ca',
                    object: DF.variable('w')
                  }),
                  dependencies: undefined
                }
              ]
            ]),
            name: "x",
            isVariable: true,

          }
        ];

        const everyExpectedStarPatternNestedUnion = [
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternNestedUnion1,

          ]),
          new Map<string, IStarPatternWithDependencies>([
            xStarPatternNestedUnion2
          ])
        ];

        const resp = generateQuery(translate(query));

        expect(resp.union?.length).toBe(1);

        expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
        expect(resp.filterExpression).toBe('');
        for (const [subject, starPatterns] of resp.starPatterns) {
          expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
        }
        const n = (resp.union ?? []).length;
        const respUnion = resp.union![0];
        for (let i = 0; i < n; i++) {
          const union = respUnion[i];
          const expectedUnionStarPattern = everyExpectedStarPatternUnion[i];

          expect(union.starPatterns.size).toBe(expectedUnionStarPattern.size);
          expect(union.filterExpression).toBe('');
          for (const [subject, starPatterns] of union.starPatterns) {
            const expectedStarPattern = expectedUnionStarPattern.get(subject);
            expect(starPatterns).toStrictEqual(expectedStarPattern);
          }
        }

        const nestedUnion = resp.union![0][1].union![0];
        expect(nestedUnion).toBeDefined();
        const nNested = (nestedUnion ?? []).length;

        for (let i = 0; i < nNested; i++) {
          const union = nestedUnion[i];
          const expectedUnionStarPattern = everyExpectedStarPatternNestedUnion[i];

          expect(union.starPatterns.size).toBe(expectedUnionStarPattern.size);
          expect(union.filterExpression).toBe('');
          for (const [subject, starPatterns] of union.starPatterns) {
            const expectedStarPattern = expectedUnionStarPattern.get(subject);
            expect(starPatterns).toStrictEqual(expectedStarPattern);
          }
        }

      });
    });

    describe("solidbench query", () => {

      describe("short", () => {
        test('interactive-short-2', () => {
          const query = `
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
          PREFIX sn: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/>
          PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
          PREFIX sntag: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/tag/>
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          PREFIX dbpedia: <http://localhost:3000/dbpedia.org/resource/>
          PREFIX dbpedia-owl: <http://localhost:3000/dbpedia.org/ontology/>
  
          SELECT
              ?messageId
              ?messageContent
              ?messageCreationDate
              ?originalPostId
              ?originalPostAuthorId
              ?originalPostAuthorFirstName
              ?originalPostAuthorLastName
          WHERE {
              ?person a snvoc:Person .
              ?person snvoc:id ?personId .
              ?message snvoc:hasCreator ?person .
              ?message snvoc:content|snvoc:imageFile ?messageContent .
              ?message snvoc:creationDate ?messageCreationDate .
              ?message snvoc:id ?messageId .
              OPTIONAL {
                  ?message snvoc:replyOf* ?originalPostInner .
                  ?originalPostInner a snvoc:Post .
              } .
              BIND( COALESCE(?originalPostInner, ?message) AS ?originalPost ) .
              ?originalPost snvoc:id ?originalPostId .
              ?originalPost snvoc:hasCreator ?creator .
              ?creator snvoc:firstName ?originalPostAuthorFirstName .
              ?creator snvoc:lastName ?originalPostAuthorLastName .
              ?creator snvoc:id ?originalPostAuthorId .
          }
          LIMIT 10
          `;

          const originalPostInnerPattern: [string, IStarPatternWithDependencies] = [
            'originalPostInner',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'originalPostInner',
                      predicate: RDF_TYPE,
                      object: DF.namedNode(`${SNVOC_PREFIX}Post`)
                    }),
                    dependencies: undefined
                  }
                ]
              ]),
              name: 'originalPostInner',
              isVariable: true,
              
            }
          ];

          const personStarPattern: [string, IStarPatternWithDependencies] = [
            'person',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'person',
                      predicate: RDF_TYPE,
                      object: DF.namedNode(`${SNVOC_PREFIX}Person`)
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'person',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable('personId')
                    }),
                    dependencies: undefined
                  }
                ]
              ]),
              name: "person",
              isVariable: true,
              
            }
          ];

          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}hasCreator`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}hasCreator`,
                      object: DF.variable('person')
                    }),
                    dependencies: personStarPattern[1]
                  }
                ],
                [
                  `${SNVOC_PREFIX}creationDate`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}creationDate`,
                      object: DF.variable('messageCreationDate')
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable('messageId')
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}replyOf`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}replyOf`,
                      object: DF.variable('originalPostInner'),
                      cardinality: { min: 0, max: -1 }
                    }),
                    dependencies: originalPostInnerPattern[1]
                  }
                ]
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const creatorStarPattern: [string, IStarPatternWithDependencies] = [
            'creator',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}firstName`,
                  {
                    triple: new Triple({
                      subject: 'creator',
                      predicate: `${SNVOC_PREFIX}firstName`,
                      object: DF.variable('originalPostAuthorFirstName')
                    })
                  }
                ],
                [
                  `${SNVOC_PREFIX}lastName`,
                  {
                    triple: new Triple({
                      subject: 'creator',
                      predicate: `${SNVOC_PREFIX}lastName`,
                      object: DF.variable('originalPostAuthorLastName')
                    })
                  }
                ],
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'creator',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable('originalPostAuthorId')
                    })
                  }
                ]
              ]),
              name: 'creator',
              isVariable: true,
              
            }
          ];

          const originalPostStarPattern: [string, IStarPatternWithDependencies] = [
            'originalPost',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'originalPost',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable('originalPostId')
                    })
                  }
                ],
                [
                  `${SNVOC_PREFIX}hasCreator`,
                  {
                    triple: new Triple({
                      subject: 'originalPost',
                      predicate: `${SNVOC_PREFIX}hasCreator`,
                      object: DF.variable('creator')
                    }),
                    dependencies: creatorStarPattern[1]
                  }
                ]
              ]),
              name: 'originalPost',
              isVariable: true,
              
            }
          ];

          const unionMessageContent: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}content`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}content`,
                      object: DF.variable('messageContent')
                    }),
                  }
                ]
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const unionMessageImageFile: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}imageFile`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}imageFile`,
                      object: DF.variable('messageContent')
                    }),
                  }
                ]
              ]),
              name: "message",
              isVariable: true,
            }
          ];

          const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
            originalPostInnerPattern,
            messageStarPattern,
            creatorStarPattern,
            originalPostStarPattern,
            personStarPattern
          ]);

          const expectedUnions = [
            new Map<string, any>([
              unionMessageContent,
            ]),
            new Map<string, any>([
              unionMessageImageFile,
            ]),
          ];

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }

          expect(resp.union).toBeDefined();
          expect(resp.union?.length).toBe(1);
          const union = resp.union![0];
          expect(union.length).toBe(2);
          for (let i = 0; i < union.length; i++) {
            const unionQuery = union[i];
            const expectedUnion = expectedUnions[i];

            for (const [subject, starPatterns] of unionQuery.starPatterns) {
              expect(starPatterns).toStrictEqual(expectedUnion.get(subject));
            }
          }
        });
      });

      describe("complex", () => {
        test('interactive-complex-8', () => {
          const query = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
          SELECT ?personId ?personFirstName ?personLastName ?commentCreationDate ?commentId ?commentContent WHERE {
            VALUES ?type {
              snvoc:Comment
              snvoc:Post
            }
            <http://localhost:3000/pods/00000002199023256816/profile/card#me> rdf:type snvoc:Person.
            ?message snvoc:hasCreator <http://localhost:3000/pods/00000002199023256816/profile/card#me>;
              rdf:type ?type.
            ?comment rdf:type snvoc:Comment;
              snvoc:replyOf ?message;
              snvoc:creationDate ?commentCreationDate;
              snvoc:id ?commentId;
              snvoc:content ?commentContent;
              snvoc:hasCreator ?person.
            ?person snvoc:id ?personId;
              snvoc:firstName ?personFirstName;
              snvoc:lastName ?personLastName.
          }
          ORDER BY DESC (?commentCreationDate) (?commentId)
          LIMIT 20`;

          const meStarPattern: [string, IStarPatternWithDependencies] = [
            'http://localhost:3000/pods/00000002199023256816/profile/card#me',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'http://localhost:3000/pods/00000002199023256816/profile/card#me',
                      predicate: RDF_TYPE,
                      object: DF.namedNode(`${SNVOC_PREFIX}Person`)
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: 'http://localhost:3000/pods/00000002199023256816/profile/card#me',
              isVariable: false,

            }
          ];
          const messageStarPattern: [string, IStarPatternWithDependencies] = [
            'message',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}hasCreator`,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: `${SNVOC_PREFIX}hasCreator`,
                      object: DF.namedNode("http://localhost:3000/pods/00000002199023256816/profile/card#me"),
                    }),
                    dependencies: meStarPattern[1]
                  }
                ],
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'message',
                      predicate: RDF_TYPE,
                      object: [DF.namedNode(`${SNVOC_PREFIX}Comment`), DF.namedNode(`${SNVOC_PREFIX}Post`)]
                    }),
                    dependencies: undefined
                  }
                ],
              ]),
              name: "message",
              isVariable: true,

            }
          ];
          const personStarPattern: [string, IStarPatternWithDependencies] = [
            'person',
            {
              starPattern: new Map([
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'person',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable("personId"),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}firstName`,
                  {
                    triple: new Triple({
                      subject: 'person',
                      predicate: `${SNVOC_PREFIX}firstName`,
                      object: DF.variable("personFirstName"),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}lastName`,
                  {
                    triple: new Triple({
                      subject: 'person',
                      predicate: `${SNVOC_PREFIX}lastName`,
                      object: DF.variable("personLastName"),
                    }),
                    dependencies: undefined
                  }
                ]
              ]),
              name: "person",
              isVariable: true,

            }
          ];
          const commentStarPattern: [string, IStarPatternWithDependencies] = [
            'comment',
            {
              starPattern: new Map([
                [
                  RDF_TYPE,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: RDF_TYPE,
                      object: DF.namedNode(`${SNVOC_PREFIX}Comment`),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}replyOf`,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: `${SNVOC_PREFIX}replyOf`,
                      object: DF.variable("message"),
                    }),
                    dependencies: messageStarPattern[1]
                  }
                ],
                [
                  `${SNVOC_PREFIX}creationDate`,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: `${SNVOC_PREFIX}creationDate`,
                      object: DF.variable("commentCreationDate"),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}id`,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: `${SNVOC_PREFIX}id`,
                      object: DF.variable("commentId"),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}content`,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: `${SNVOC_PREFIX}content`,
                      object: DF.variable("commentContent"),
                    }),
                    dependencies: undefined
                  }
                ],
                [
                  `${SNVOC_PREFIX}hasCreator`,
                  {
                    triple: new Triple({
                      subject: 'comment',
                      predicate: `${SNVOC_PREFIX}hasCreator`,
                      object: DF.variable("person"),
                    }),
                    dependencies: personStarPattern[1]
                  }
                ]
              ]),
              name: "comment",
              isVariable: true,

            }
          ];

          const expectedStarPattern = new Map<string, IStarPatternWithDependencies>([
            meStarPattern,
            messageStarPattern,
            commentStarPattern,
            personStarPattern
          ]);

          const resp = generateQuery(translate(query));

          expect(resp.starPatterns.size).toBe(expectedStarPattern.size);
          expect(resp.filterExpression).toBe('');
          for (const [subject, starPatterns] of resp.starPatterns) {
            expect(starPatterns).toStrictEqual(expectedStarPattern.get(subject));
          }
        });

        /** 
      it('complex query 1', () => {
        const query = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
        SELECT * WHERE {
          ?s snvoc:id ?messageId;
            snvoc:hasCreator ?messageCreator.
          ?messageCreator snvoc:id ?messageCreatorId.
          ?comment snvoc:replyOf <http://localhost:3000/pods/00000002199023256081/comments/Philippines#274878069404>;
            rdf:type snvoc:Comment.
          ?replyAuthor snvoc:id ?replyAuthorId;
            snvoc:firstName ?replyAuthorFirstName;
          OPTIONAL {
            ?messageCreator ((snvoc:knows/snvoc:hasPerson)|^(snvoc:knows/snvoc:hasPerson)) ?replyAuthor.
            BIND("true"^^xsd:boolean AS ?replyAuthorKnowsOriginalMessageAuthorInner)
          }
          BIND(COALESCE(?replyAuthor, "false"^^xsd:boolean) AS ?replyAuthorKnowsOriginalMessageAuthorInner)
        }`;
        const comment_philippines = 'http://localhost:3000/pods/00000002199023256081/comments/Philippines#274878069404';
        const expectedResp = new Map([
          ['s',
            [
              { subject: 's', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('messageId') },
              { subject: 's', predicate: `${SNVOC_PREFIX}hasCreator`, object: DF.variable('messageCreator') },
            ],
          ],
          [
            'messageCreator',
            [
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('messageCreatorId') },
            ],
          ],
          [
            'comment',
            [
              { subject: 'comment', predicate: `${SNVOC_PREFIX}replyOf`, object: DF.namedNode(comment_philippines) },
              { subject: 'comment', predicate: `${RDF_TYPE}`, object: DF.namedNode(`${SNVOC_PREFIX}Comment`) },
            ],
          ],
          [
            'replyAuthor',
            [
              { subject: 'replyAuthor', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('replyAuthorId') },
              { subject: 'replyAuthor', predicate: `${SNVOC_PREFIX}firstName`, object: DF.variable('replyAuthorFirstName') },
            ],
          ],
          [
            'messageCreator',
            [
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('messageCreatorId') },
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}knows`, object: DF.variable('replyAuthor') },
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}hasPerson`, object: DF.variable('replyAuthor') },
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}knows`, object: DF.variable('replyAuthor') },
              { subject: 'messageCreator', predicate: `${SNVOC_PREFIX}hasPerson`, object: DF.variable('replyAuthor') },
            ],
          ],
        ]);
  
        const resp = generateQuery(translate(query));
  
        expect(resp.size).toBe(expectedResp.size);
        for (const [subject, triples] of resp) {
          for (const [i, triple] of triples.entries()) {
            expect(triple.toObject()).toStrictEqual(expectedResp.get(subject)![i]);
          }
        }
      });
  
      it('should returns the subject groups with a complex query 2', () => {
        const query = `# Recent messages of a person
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        PREFIX sn: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/data/>
        PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
        PREFIX sntag: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/tag/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX dbpedia: <http://localhost:3000/dbpedia.org/resource/>
        PREFIX dbpedia-owl: <http://localhost:3000/dbpedia.org/ontology/>
        
        SELECT *
        WHERE {
            ?person a snvoc:Person .
            ?person snvoc:id ?personId .
            ?message snvoc:id ?messageId .
            OPTIONAL {
                ?message snvoc:replyOf* ?originalPostInner .
                ?message !(snvoc:shouldNotExist) ?originalPostInner .
                ?originalPostInner a snvoc:Post .
            } .
            BIND( COALESCE(?originalPostInner, ?message) AS ?originalPost ) .
            ?creator snvoc:id ?originalPostAuthorId .
        }
        LIMIT 10
        `;
        const expectedResp = new Map([
          [
            'person',
            [
              { subject: 'person', predicate: `${RDF_TYPE}`, object: DF.namedNode(`${SNVOC_PREFIX}Person`) },
              { subject: 'person', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('personId') },
            ],
          ],
          [
            'message',
            [
              { subject: 'message', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('messageId') },
              { subject: 'message', predicate: `${SNVOC_PREFIX}replyOf`, object: DF.variable('originalPostInner') },
            ],
          ],
          [
            'originalPostInner',
            [
              { subject: 'originalPostInner', predicate: `${RDF_TYPE}`, object: DF.namedNode(`${SNVOC_PREFIX}Post`) },
            ],
          ],
          [
            'creator',
            [
              { subject: 'creator', predicate: `${SNVOC_PREFIX}id`, object: DF.variable('originalPostAuthorId') },
            ],
          ],
        ]);
  
        const resp = generateQuery(translate(query));
  
        expect(resp.size).toBe(expectedResp.size);
        for (const [subject, triples] of resp) {
          for (const [i, triple] of triples.entries()) {
            expect(triple.toObject()).toStrictEqual(expectedResp.get(subject)![i]);
          }
        }
      });
      */
      });

    });
  });
});

