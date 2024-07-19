import { translate } from 'sparqlalgebrajs';
import { ContraintType, IShape, Shape } from '../lib/Shape';
import { IStarPatternWithDependencies, Triple } from '../lib/Triple';
import { ContainmentResult, IConditionalLink, IContainmentResult, IResult, StarPatternName, solveShapeQueryContainment } from '../lib/containment';
import { DataFactory } from 'rdf-data-factory';
import { BaseQuad } from '@rdfjs/types';
import { IQuery, generateQuery } from '../lib/query';
import { TYPE_DEFINITION } from '../lib/constant';
import type * as RDF from '@rdfjs/types';
import * as N3 from 'n3';
import { readFileSync } from 'fs';
import streamifyArray from 'streamify-array';
import { shapeFromQuads } from '../lib/shex';

const DF = new DataFactory<BaseQuad>();
const n3Parser = new N3.Parser();

describe('solveShapeQueryContainment', () => {

    describe('virtual use case', () => {
        const shape: Shape = new Shape({
            name: 'foo', positivePredicates: [
                {
                    name: "https://www.example.ca/p0",
                    constraint: {
                        value: new Set(['foo1']),
                        type: ContraintType.SHAPE
                    }
                },
                {
                    name: "https://www.example.ca/p1",
                    constraint: {
                        value: new Set(['foo2']),
                        type: ContraintType.SHAPE
                    }
                },
                {
                    name: "https://www.example.ca/p2",
                    constraint: {
                        value: new Set(['foo3']),
                        type: ContraintType.SHAPE
                    }
                },
            ], closed: true
        });


        const shapeP1: Shape = new Shape({
            name: 'foo1', positivePredicates: [
                {
                    name: "https://www.example.ca/p1",
                    constraint: {
                        type: ContraintType.TYPE,
                        value: new Set(["https://www.example.ca/t0"])
                    }
                }
            ], closed: true
        });

        const shapeP2: Shape = new Shape({
            name: 'foo2', positivePredicates: [
                "https://www.example.ca/p1",
                "https://www.example.ca/p2"
            ], closed: true
        });

        const shapeP3: Shape = new Shape({
            name: 'foo3', positivePredicates: [
                {
                    name: "https://www.example.ca/p1",
                    constraint: {
                        value: new Set(['foo4']),
                        type: ContraintType.SHAPE
                    }
                },
                "https://www.example.ca/p3"
            ], closed: true
        });

        const shapeP4: Shape = new Shape({
            name: 'foo4', positivePredicates: [
                {
                    name: "https://www.example.ca/p1",
                    constraint: {
                        value: new Set(['foo5']),
                        type: ContraintType.SHAPE
                    }
                },
                "https://www.example.ca/p2",
                "https://www.example.ca/p3"
            ], closed: true
        });

        const shapeP5: Shape = new Shape({
            name: 'foo5', positivePredicates: [
                "https://www.example.ca/p1"
            ], closed: true
        });

        const shapeP6: Shape = new Shape({
            name: 'foo6', positivePredicates: [
                "https://www.example.ca/p1000000"
            ], closed: true
        });

        const shapeP7: Shape = new Shape({
            name: 'foo7', positivePredicates: [
                {
                    name: TYPE_DEFINITION.value,
                    constraint: {
                        value: new Set(['<https://www.example.ca/Type>']),
                        type: ContraintType.SHAPE
                    }
                }

            ], closed: true
        });

        const shapeP8: Shape = new Shape({
            name: 'foo8', positivePredicates: [
                {
                    name: TYPE_DEFINITION.value,
                    constraint: {
                        value: new Set(['<https://www.example.ca/Type>']),
                        type: ContraintType.SHAPE
                    }
                }

            ], closed: true
        });

        it('should return an empty result given an empty query and no shape', () => {
            const query: IQuery = {
                starPatterns: new Map()
            };
            const shapes: IShape[] = [];
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: new Map(),
                visitShapeBoundedResource: new Map()
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should reject every shape given an empty query', () => {
            const query: IQuery = {
                starPatterns: new Map()
            };
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: new Map(),
                visitShapeBoundedResource: new Map(shapes.map((shape) => [shape.name, false]))
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should return an empty result given no shape', () => {

            const query: IQuery = {
                starPatterns: new Map([
                    ["x", generateZStarPattern()]
                ])
            };
            const shapes: IShape[] = [];
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: new Map([["x", { result: ContainmentResult.REJECTED }]]),
                visitShapeBoundedResource: new Map()
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should handle aligned triple pattern', () => {
            const xStarPattern = generateXStarPattern();
            const query: IQuery = {
                starPatterns: new Map([
                    ["x", xStarPattern]
                ])
            };
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];

            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: new Map([["x", { result: ContainmentResult.CONTAIN, target: [shape.name] }]]),
                visitShapeBoundedResource: new Map([
                    [shape.name, true],
                    [shapeP1.name, false],
                    [shapeP2.name, false],
                    [shapeP3.name, false],
                    [shapeP4.name, false],
                    [shapeP5.name, false]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should handle unaligned triple pattern with term object', () => {
            const zStarPattern = generateZStarPattern();
            const query: IQuery = {
                starPatterns: new Map([
                    ["z", zStarPattern]
                ])
            };
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];

            const expectedResult: IResult = {
                conditionalLink: [

                ],
                starPatternsContainment: new Map([["z", { result: ContainmentResult.REJECTED }]]),
                visitShapeBoundedResource: new Map([
                    [shape.name, false],
                    [shapeP1.name, false],
                    [shapeP2.name, false],
                    [shapeP3.name, false],
                    [shapeP4.name, false],
                    [shapeP5.name, false]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should handle unaligned triple pattern', () => {
            const zStarPattern = generateZAlternatifStarPattern();
            const query: IQuery = {
                starPatterns: new Map([
                    ["z", zStarPattern]
                ])
            };
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];

            const expectedResult: IResult = {
                conditionalLink: [
                    {
                        link: "foo",
                        starPatternName: "z"
                    }
                ],
                starPatternsContainment: new Map([["z", { result: ContainmentResult.REJECTED }]]),
                visitShapeBoundedResource: new Map([
                    [shape.name, false],
                    [shapeP1.name, false],
                    [shapeP2.name, false],
                    [shapeP3.name, false],
                    [shapeP4.name, false],
                    [shapeP5.name, false]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);
        });

        it('should handle a query contained in every shape', () => {
            const query = generateMatchingQuery();
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];

            const expectedStarPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["x", { result: ContainmentResult.CONTAIN, target: [shape.name] }],
                ["y", { result: ContainmentResult.DEPEND, target: ['foo1'] }],
                ["z", { result: ContainmentResult.DEPEND, target: ['foo2'] }],
                ["w", { result: ContainmentResult.DEPEND, target: ['foo3'] }],
                ["w1", { result: ContainmentResult.DEPEND, target: ['foo4'] }],
                ["w2", { result: ContainmentResult.DEPEND, target: ['foo5'] }],

            ]);
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: expectedStarPatternsContainment,
                visitShapeBoundedResource: new Map([
                    [shape.name, true],
                    [shapeP1.name, true],
                    [shapeP2.name, true],
                    [shapeP3.name, true],
                    [shapeP4.name, true],
                    [shapeP5.name, true]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);

        });

        it('should handle a query with partial containment', () => {
            const query = generateAlignedQuery();

            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5, shapeP6];

            const expectedStarPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["x", { result: ContainmentResult.REJECTED }],
                ["y", { result: ContainmentResult.CONTAIN, target: [shape.name, shapeP1.name, shapeP2.name, shapeP3.name, shapeP4.name, shapeP5.name] }],
                ["z", { result: ContainmentResult.CONTAIN, target: [shape.name, shapeP2.name, shapeP3.name, shapeP4.name, shapeP5.name] }],
                ["w", { result: ContainmentResult.ALIGNED, target: [shapeP3.name, shapeP4.name], bindingByRdfClass: [] }],
            ]);
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: expectedStarPatternsContainment,
                visitShapeBoundedResource: new Map([
                    [shape.name, true],
                    [shapeP1.name, true],
                    [shapeP2.name, true],
                    [shapeP3.name, true],
                    [shapeP4.name, true],
                    [shapeP5.name, true],
                    [shapeP6.name, false]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);

        });

        it('should handle a query with partial containment and a binding by a class', () => {
            const query = generateAlignedWithRdfTypeQuery();

            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5, shapeP7, shapeP8];

            const expectedStarPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["x", { result: ContainmentResult.REJECTED }],
                ["y", { result: ContainmentResult.CONTAIN, target: [shapeP7.name, shapeP8.name] }],
                ["z", {
                    result: ContainmentResult.ALIGNED,
                    target: [shapeP7.name, shapeP8.name],
                    bindingByRdfClass: [shapeP7.name, shapeP8.name]
                }],
                ["zz", {
                    result: ContainmentResult.ALIGNED,
                    target: [shapeP7.name, shapeP8.name],
                    bindingByRdfClass: [shapeP7.name, shapeP8.name]
                }],
                ["w", { result: ContainmentResult.ALIGNED, target: [shapeP3.name, shapeP4.name], bindingByRdfClass: [] }],
            ]);
            const expectedResult: IResult = {
                conditionalLink: [
                    {
                        link: "https://www.example.ca/Type",
                        starPatternName: "z",
                    },
                    {
                        link: "https://www.example.ca/IDK",
                        starPatternName: "zz",
                    },
                ],
                starPatternsContainment: expectedStarPatternsContainment,
                visitShapeBoundedResource: new Map([
                    [shape.name, false],
                    [shapeP1.name, false],
                    [shapeP2.name, false],
                    [shapeP3.name, true],
                    [shapeP4.name, true],
                    [shapeP5.name, false],
                    [shapeP7.name, true],
                    [shapeP8.name, true],
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes, dependentShapes: [shapeP6] })).toStrictEqual(expectedResult);

        });

        it('should handle a query with cycle', () => {
            const query = generateQueryWithCycle();
            const shapes: IShape[] = [shape, shapeP1, shapeP2, shapeP3, shapeP4, shapeP5];

            const expectedStarPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["x", {
                    result: ContainmentResult.ALIGNED,
                    bindingByRdfClass: [],
                    target: [shape.name, shapeP1.name, shapeP2.name, shapeP4.name, shapeP5.name]
                }],
                ["y", { result: ContainmentResult.CONTAIN, target: [shapeP1.name, shapeP2.name, shapeP5.name] }],
                ["z", { result: ContainmentResult.CONTAIN, target: [shape.name] }],
            ]);
            const expectedResult: IResult = {
                conditionalLink: [],
                starPatternsContainment: expectedStarPatternsContainment,
                visitShapeBoundedResource: new Map([
                    [shape.name, true],
                    [shapeP1.name, true],
                    [shapeP2.name, true],
                    [shapeP3.name, false],
                    [shapeP4.name, true],
                    [shapeP5.name, true]
                ])
            };

            expect(solveShapeQueryContainment({ query, shapes })).toStrictEqual(expectedResult);

        });

        function generateMatchingQuery(): IQuery {
            const queryString = `
            SELECT * WHERE { 
                ?x <https://www.example.ca/p0> ?y .
                ?x <https://www.example.ca/p1> ?z .
                ?x <https://www.example.ca/p2> ?w .
        
                ?y <https://www.example.ca/p1> "foo"^^<https://www.example.ca/t0> .
        
                ?z <https://www.example.ca/p1> "abc" .
                
                ?w <https://www.example.ca/p1> ?w1 .
                
                ?w1 <https://www.example.ca/p1> ?w2 .
        
                ?w2 <https://www.example.ca/p1> "bar"
              }
            `;
            const querySparql = translate(queryString);


            return generateQuery(querySparql);
        }

        function generateQueryWithCycle(): IQuery {
            const queryString = `
            SELECT * WHERE { 
                ?x <https://www.example.ca/p0> ?y .
                ?x <https://www.example.ca/p1> ?z .
                ?x <https://www.example.ca/p2> ?w .
        
                ?y <https://www.example.ca/p1> ?x .

                ?z <https://www.example.ca/p0> "abc" .

              }
            `;
            const querySparql = translate(queryString);


            return generateQuery(querySparql);
        }

        function generateAlignedQuery(): IQuery {
            const queryString = `
            SELECT * WHERE { 
                ?x <https://www.example.ca/p7> ?y .
                ?x <https://www.example.ca/p6> ?z .
                ?x <https://www.example.ca/p5> ?w .
        
                ?y <https://www.example.ca/p1> "foo"^^<https://www.example.ca/t0> .
        
                ?z <https://www.example.ca/p1> "abc" .
                
                ?w <https://www.example.ca/p3> ?w1 .
                ?w <https://www.example.ca/p10> ?w1 .
              }
            `;
            const querySparql = translate(queryString);


            return generateQuery(querySparql);
        }

        function generateAlignedWithRdfTypeQuery(): IQuery {
            const queryString = `
            SELECT * WHERE { 
                ?x <https://www.example.ca/p7> ?y .
                ?x <https://www.example.ca/p6> ?z .
                ?x <https://www.example.ca/p5> ?w .
        
                ?y <${TYPE_DEFINITION.value}> <https://www.example.ca/Type> .
        
                ?z <${TYPE_DEFINITION.value}> <https://www.example.ca/Type> .
                ?z <https://www.example.ca/p0972> <https://www.example.ca/Type> .
                
                ?w <https://www.example.ca/p3> ?w1 .
                ?w <https://www.example.ca/p10> ?w1 .
        
                ?zz <${TYPE_DEFINITION.value}> <https://www.example.ca/Kipe> .
                ?zz <https://www.example.ca/p0972> <https://www.example.ca/IDK> .
              }
            `;
            const querySparql = translate(queryString);


            return generateQuery(querySparql);
        }

        function generateXStarPattern(): IStarPatternWithDependencies {
            const triple1: Triple = new Triple({
                subject: 'x',
                predicate: 'https://www.example.ca/p0',
                object: DF.literal('o0', DF.namedNode("https://www.example.ca/t0"))
            });


            const starPattern: IStarPatternWithDependencies = {
                starPattern: new Map([
                    [
                        triple1.predicate,
                        {
                            triple: triple1,
                            dependencies: undefined
                        }
                    ],
                ]),
                name: "x",
                isVariable: true,
                oneOfs: []
            };

            return starPattern;
        }

        function generateZStarPattern(): IStarPatternWithDependencies {
            const triple1: Triple = new Triple({
                subject: 'z',
                predicate: 'p99',
                object: DF.literal('o0', DF.namedNode("https://www.example.ca/t0"))
            });


            const starPattern: IStarPatternWithDependencies = {
                starPattern: new Map([
                    [
                        triple1.predicate,
                        {
                            triple: triple1,
                            dependencies: undefined
                        }
                    ],
                ]),
                name: "z",
                isVariable: true,
                oneOfs: []
            };

            return starPattern;
        }

        function generateZAlternatifStarPattern(): IStarPatternWithDependencies {
            const triple1: Triple = new Triple({
                subject: 'z',
                predicate: 'p99',
                object: DF.namedNode('foo')
            });


            const starPattern: IStarPatternWithDependencies = {
                starPattern: new Map([
                    [
                        triple1.predicate,
                        {
                            triple: triple1,
                            dependencies: undefined
                        }
                    ],
                ]),
                name: "z",
                isVariable: true,
                oneOfs: []
            };

            return starPattern;
        }

    });

    describe('real use case', () => {
        it('interactive-short-1', async () => {
            const queryString = `
            # Profile of a person
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
    ?firstName
    ?lastName
    ?birthday
    ?locationIP
    ?browserUsed
    ?cityId
    ?gender
    ?creationDate
WHERE
{
    ?person a snvoc:Person .
    ?person snvoc:id ?personId .
    ?person snvoc:firstName ?firstName .
    ?person snvoc:lastName ?lastName .
    ?person snvoc:gender ?gender .
    ?person snvoc:birthday ?birthday .
    ?person snvoc:creationDate ?creationDate .
    ?person snvoc:locationIP ?locationIP .
    ?person snvoc:isLocatedIn ?city .
    ?city snvoc:id ?cityId .
    ?person snvoc:browserUsed ?browserUsed .
}

            `;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["person", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Profile"] }],
                ["city", { result: ContainmentResult.DEPEND }]
            ]);


            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-short-5', async () => {
            const queryString = `PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            SELECT ?personId ?firstName ?lastName WHERE {
              <http://localhost:3000/pods/00000000000000000150/comments/Mexico#68719564521> snvoc:id ?messageId;
                snvoc:hasCreator ?creator.
              ?creator snvoc:id ?personId;
                snvoc:firstName ?firstName;
                snvoc:lastName ?lastName.
            }`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["http://localhost:3000/pods/00000000000000000150/comments/Mexico#68719564521", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment", "http://example.com#Post"] }],
                ["creator", { result: ContainmentResult.DEPEND, target: ["http://example.com#Profile"] }]
            ]);


            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-1', async () => {
            const queryString = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            SELECT ?messageId ?messageCreationDate ?messageContent WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>;
                rdf:type snvoc:Post;
                snvoc:content ?messageContent;
                snvoc:creationDate ?messageCreationDate;
                snvoc:id ?messageId.
            }`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Post"] }],
            ]);


            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-3', async () => {
            const queryString = `PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            SELECT ?tagName (COUNT(?message) AS ?messages) WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>;
                snvoc:hasTag ?tag.
              ?tag foaf:name ?tagName.
            }
            GROUP BY ?tagName
            ORDER BY DESC (?messages)`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", false]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment", "http://example.com#Post"] }],
                ["tag", { result: ContainmentResult.DEPEND }],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-4', async () => {
            const queryString = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            SELECT ?locationName (COUNT(?message) AS ?messages) WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>;
                rdf:type snvoc:Comment;
                snvoc:isLocatedIn ?location.
              ?location foaf:name ?locationName.
            }
            GROUP BY ?locationName
            ORDER BY DESC (?messages)`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment"] }],
                ["location", { result: ContainmentResult.DEPEND }],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-5', async () => {
            const queryString = `PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            SELECT DISTINCT ?locationIp WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>;
                snvoc:locationIP ?locationIp.
            }`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment", "http://example.com#Post"] }],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-6', async () => {
            const queryString = `PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            SELECT DISTINCT ?forumId ?forumTitle WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>.
              ?forum snvoc:containerOf ?message;
                snvoc:id ?forumId;
                snvoc:title ?forumTitle.
            }`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment", "http://example.com#Post"] }],
                ["forum",
                    {
                        result: ContainmentResult.ALIGNED,
                        target: ["http://example.com#Comment", "http://example.com#Post", "http://example.com#Profile"],
                        bindingByRdfClass: [],
                    }
                ],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-discover-7', async () => {
            const queryString = `PREFIX snvoc: <http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
            SELECT DISTINCT ?firstName ?lastName WHERE {
              ?message snvoc:hasCreator <http://localhost:3000/pods/00000000000000000933/profile/card#me>.
              ?forum snvoc:containerOf ?message;
                snvoc:hasModerator ?moderator.
              ?moderator snvoc:firstName ?firstName;
                snvoc:lastName ?lastName.
            }`;
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["message", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment", "http://example.com#Post"] }],
                ["forum", { result: ContainmentResult.REJECTED }],
                ["moderator", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Profile"] }],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        it('interactive-complex-8', async () => {
            const queryString = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
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
            const querySparql = translate(queryString);
            const query = generateQuery(querySparql);

            const shapeIndexed: Map<string, IShape> = await generateSolidBenchShapes();
            const shapes: IShape[] = Array.from(shapeIndexed.values());

            const resp = solveShapeQueryContainment({ query, shapes });

            const conditionalLink: IConditionalLink[] = [];
            const visitShapeBoundedResource = new Map([
                ["http://example.com#Comment", true],
                ["http://example.com#Post", true],
                ["http://example.com#Profile", true]
            ]);
            const starPatternsContainment = new Map<StarPatternName, IContainmentResult>([
                ["http://localhost:3000/pods/00000002199023256816/profile/card#me", { result: ContainmentResult.DEPEND, target: ["http://example.com#Profile"] }],
                ["message", { result: ContainmentResult.DEPEND, target: ["http://example.com#Post", "http://example.com#Comment"] }],
                ["comment", { result: ContainmentResult.CONTAIN, target: ["http://example.com#Comment"] }],
                ["person", { result: ContainmentResult.DEPEND, target: ["http://example.com#Profile"] }],
            ]);

            expect(resp).toStrictEqual({ conditionalLink, visitShapeBoundedResource, starPatternsContainment });
        });

        async function generateSolidBenchShapes(): Promise<Map<string, IShape>> {
            const commentShapeFile = "./test/shape/solidbench_comment.ttl";
            const postShapeFile = "./test/shape/solidbench_post.ttl";
            const profileShapeFile = "./test/shape/solidbench_profile.ttl";

            const commentShape = await shapeFromQuads(populateStream(commentShapeFile), "http://example.com#Comment");
            const postShape = await shapeFromQuads(populateStream(postShapeFile), "http://example.com#Post");
            const profileShape = await shapeFromQuads(populateStream(profileShapeFile), "http://example.com#Profile");
            if ((commentShape instanceof Error) || (postShape instanceof Error) || (profileShape instanceof Error)) {
                throw commentShape
            }

            return new Map([
                [commentShape.name, commentShape],
                [postShape.name, postShape],
                [profileShape.name, profileShape]
            ]);
        }

        function populateStream(source: string | RDF.Quad[]) {
            let quads;
            if (Array.isArray(source)) {
                quads = source;
            } else {
                quads = n3Parser.parse(readFileSync(source).toString());
            }
            return streamifyArray(quads);
        }
    })
});

