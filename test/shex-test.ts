import { readFileSync } from 'fs';
import type * as RDF from '@rdfjs/types';
import * as N3 from 'n3';
import { DataFactory } from 'rdf-data-factory';
import streamifyArray from 'streamify-array';
import { SHEX_SHAPE, TYPE_DEFINITION, SHEX_PREDICATE } from '../lib/constant';
import { ContraintType, type IShape } from '../lib/Shape';
import { shapeFromQuads } from '../lib/shex';

const DF = new DataFactory<RDF.BaseQuad>();
const n3Parser = new N3.Parser();

describe('shapeFromQuads', () => {
  const shapeIri = 'http:exemple.ca/foo';

  const emptyQuad: any = [];
  const unRelatedQuads: any = [
    DF.quad(
      DF.namedNode('foo'),
      DF.namedNode(shapeIri),
      DF.blankNode(),
    ),
    DF.quad(
      DF.blankNode(),
      DF.namedNode('bar'),
      DF.blankNode(),
    ),
    DF.quad(
      DF.namedNode('a'),
      TYPE_DEFINITION,
      SHEX_SHAPE,
    ),
    DF.quad(
      DF.namedNode('a'),
      SHEX_PREDICATE,
      DF.blankNode(),
    ),
  ];
  const shapeWithOneProperty: any = n3Parser.parse(readFileSync('./test/shape/shex_shape_one_property.ttl').toString());
  const closedShapeWithMultipleProperties = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_closed_multiple_properties.ttl').toString(),
  );
  const twoShapes = n3Parser.parse(readFileSync('./test/shape/shex_two_shapes.ttl').toString());
  const shapeWithShapeExpression = n3Parser.parse(
    readFileSync('./test/shape/shex_with_shape_expression.ttl').toString(),
  );

  const shapeNoPredicate = n3Parser.parse(readFileSync('./test/shape/shex_invalid_shape_no_predicate.ttl').toString());
  const shapeIncompleteRdfList = n3Parser.parse(
    readFileSync('./test/shape/shex_invalid_shape_incomplete_rdf_list.ttl').toString(),
  );

  const shapeWithANegativeProperty = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_with_a_negative_property.ttl').toString(),
  );
  const shapeWithInverseAndPositiveProperties = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_positive_and_negative_properties.ttl').toString(),
  );
  const shapeWithInconsistentPositiveAndNegativeProperties = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_inconsistent_positive_and_negative_properties.ttl').toString(),
  );
  const shapeWithMultipleCardinality = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_multiple_cardinality.ttl').toString(),
  );

  const shapeWithConstraints = n3Parser.parse(
    readFileSync('./test/shape/shex_shape_with_constraints.ttl').toString(),
  );

  describe('quad array', () => {
    it('should returns an error given an empty quad array', async() => {
      expect(await shapeFromQuads(emptyQuad, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns an error given unrelated quads', async() => {
      expect(await shapeFromQuads(unRelatedQuads, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns a Shape with one property given some quads', async() => {
      const shape = await shapeFromQuads(shapeWithOneProperty, shapeIri);

      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).positivePredicates).toStrictEqual([ 'http://example.org/state' ]);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a closed Shape with multiple properties given some quads', async() => {
      const shape = await shapeFromQuads(closedShapeWithMultipleProperties, shapeIri);
      const expectedPredicates: string[] = [
        'http://ex.example/#state',
        'http://foaf.example/#name',
        'http://foaf.example/#mbox',
        'http://foaf.example/#hunter',
        'http://foaf.example/#me',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(true);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a  Shape with multiple properties given some quads representing two shapes', async() => {
      const shape = await shapeFromQuads(twoShapes, shapeIri);
      const expectedPredicates: string[] = [
        'http://foaf.example/#name',
        'http://foaf.example/#mbox',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns an error given quads representing a shape with no predicate', async() => {
      expect(await shapeFromQuads(shapeNoPredicate, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns an error given quads representing a shape with an incomplete RDF list', async() => {
      expect(await shapeFromQuads(shapeIncompleteRdfList, shapeIri)).toBeInstanceOf(Error);
    });

    it(`should returns a closed Shape with multiple properties  
    given some quads representing a shape with a shape expression`, async() => {
      const shape = await shapeFromQuads(shapeWithShapeExpression, shapeIri);
      const prefix = 'http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary';
      const expectedPredicates: string[] = [
        'http://www.w3.org/ns/pim/space#storage',
        `${prefix}/id`,
        `${prefix}/firstName`,
        `${prefix}/lastName`,
        `${prefix}/gender`,
        `${prefix}/birthday`,
        `${prefix}/locationIP`,
        `${prefix}/browserUsed`,
        `${prefix}/creationDate`,
        `${prefix}/isLocatedIn`,
        `${prefix}/speaks`,
        `${prefix}/email`,
        `${prefix}/hasInterest`,
        `${prefix}/studyAt`,
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(true);

      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a Shape with a negative property', async() => {
      const shape = await shapeFromQuads(shapeWithANegativeProperty, shapeIri);
      const expectedPredicates: string[] = [
      ];
      const negativePredicates: string[] = [
        'http://example.org/state',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a Shape with positive and negative properties', async() => {
      const shape = await shapeFromQuads(shapeWithInverseAndPositiveProperties, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop2',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should handle a shape with multiple cardinalities', async() => {
      const shape = await shapeFromQuads(shapeWithMultipleCardinality, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
        'http://xmlns.com/foaf/0.1/prop5',
        'http://xmlns.com/foaf/0.1/prop6',
        'http://xmlns.com/foaf/0.1/prop7',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop2',
      ];
      const mapCardinality = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1', { min: 1, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop3', { min: 5, max: 5 }],
        [ 'http://xmlns.com/foaf/0.1/prop4', { min: 1, max: 4 }],
        [ 'http://xmlns.com/foaf/0.1/prop5', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop6', { min: 0, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop7', { min: 0, max: -1 }],
      ]);
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
      for (const predicate of (<IShape>shape).positivePredicates) {
        const expectedCardinality = mapCardinality.get(predicate);
        const cardinality = (<IShape>shape).get(predicate)?.cardinality;
        expect(cardinality).toStrictEqual(expectedCardinality);
      }
    });

    it('should handle a shape with constraints', async() => {
      const shape = await shapeFromQuads(shapeWithConstraints, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop2',
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
        'http://xmlns.com/foaf/0.1/prop5',
        'http://xmlns.com/foaf/0.1/prop6',
        'http://xmlns.com/foaf/0.1/prop7',
        'http://xmlns.com/foaf/0.1/prop8',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop9',
      ];
      const mapCardinality = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1', { min: 0, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop2', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop3', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop4', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop5', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop6', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop7', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop8', { min: 1, max: -1 }],
      ]);

      const mapConstraint = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1',
          {
            type: ContraintType.SHAPE,
            value: [ 'http:exemple.ca/bar' ],
          },
        ],
        [ 'http://xmlns.com/foaf/0.1/prop2', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop3', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop4', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop5', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop6', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop7', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop8', undefined ],
      ]);
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
      for (const predicate of (<IShape>shape).positivePredicates) {
        const expectedCardinality = mapCardinality.get(predicate);
        const expectedConstraint = mapConstraint.get(predicate);

        const resPredicate = (<IShape>shape).get(predicate);
        expect(resPredicate?.cardinality).toStrictEqual(expectedCardinality);
        expect(resPredicate?.constraint).toStrictEqual(expectedConstraint);
      }
    });

    it('should throw an error given a shape with inconsistent positive and negative properties', async() => {
      expect(
        await shapeFromQuads(shapeWithInconsistentPositiveAndNegativeProperties, shapeIri),
      ).toBeInstanceOf(Error);
    });
  });

  describe('quad stream', () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let emptyQuad: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let unRelatedQuads: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithOneProperty: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let closedShapeWithMultipleProperties: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let twoShapes: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithShapeExpression: any;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeNoPredicate: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeIncompleteRdfList: any;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithANegativeProperty: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithInverseAndPositiveProperties: any;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithInconsistentPositiveAndNegativeProperties: any;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithMultipleCardinality: any;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let shapeWithConstraints: any;

    const unRelatedQuadsArray: any = [
      DF.quad(
        DF.namedNode('foo'),
        DF.namedNode(shapeIri),
        DF.blankNode(),
      ),
      DF.quad(
        DF.blankNode(),
        DF.namedNode('bar'),
        DF.blankNode(),
      ),
      DF.quad(
        DF.namedNode('a'),
        TYPE_DEFINITION,
        SHEX_SHAPE,
      ),
      DF.quad(
        DF.namedNode('a'),
        SHEX_PREDICATE,
        DF.blankNode(),
      ),
    ];
    beforeEach(() => {
      emptyQuad = populateStream([]);
      unRelatedQuads = populateStream(unRelatedQuadsArray);
      shapeWithOneProperty = populateStream('./test/shape/shex_shape_one_property.ttl');
      closedShapeWithMultipleProperties = populateStream('./test/shape/shex_shape_closed_multiple_properties.ttl');
      twoShapes = populateStream('./test/shape/shex_two_shapes.ttl');

      shapeNoPredicate = populateStream('./test/shape/shex_invalid_shape_no_predicate.ttl');
      shapeIncompleteRdfList = populateStream('./test/shape/shex_invalid_shape_incomplete_rdf_list.ttl');
      shapeWithShapeExpression = populateStream('./test/shape/shex_with_shape_expression.ttl');

      shapeWithANegativeProperty = populateStream('./test/shape/shex_shape_with_a_negative_property.ttl');
      shapeWithInverseAndPositiveProperties = populateStream(
        './test/shape/shex_shape_positive_and_negative_properties.ttl',
      );
      shapeWithInconsistentPositiveAndNegativeProperties = populateStream(
        './test/shape/shex_shape_inconsistent_positive_and_negative_properties.ttl',
      );

      shapeWithMultipleCardinality = populateStream(
        './test/shape/shex_shape_multiple_cardinality.ttl',
      );

      shapeWithConstraints = populateStream(
        './test/shape/shex_shape_with_constraints.ttl',
      );
    });

    it('should returns an error given an empty stream', async() => {
      expect(await shapeFromQuads(emptyQuad, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns an error given unrelated quads', async() => {
      expect(await shapeFromQuads(unRelatedQuads, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns a Shape with one property given some quads', async() => {
      const shape = await shapeFromQuads(shapeWithOneProperty, shapeIri);

      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).positivePredicates).toStrictEqual([ 'http://example.org/state' ]);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a closed Shape with multiple properties  given some quads', async() => {
      const shape = await shapeFromQuads(closedShapeWithMultipleProperties, shapeIri);
      const expectedPredicates: string[] = [
        'http://ex.example/#state',
        'http://foaf.example/#name',
        'http://foaf.example/#mbox',
        'http://foaf.example/#hunter',
        'http://foaf.example/#me',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(true);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a  Shape with multiple properties  given some quads representing two shapes', async() => {
      const shape = await shapeFromQuads(twoShapes, shapeIri);
      const expectedPredicates: string[] = [
        'http://foaf.example/#name',
        'http://foaf.example/#mbox',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns an error given quads representing a shape with no predicate', async() => {
      expect(await shapeFromQuads(shapeNoPredicate, shapeIri)).toBeInstanceOf(Error);
    });

    it('should returns an error given quads representing a shape with an incomplete RDF list', async() => {
      expect(await shapeFromQuads(shapeIncompleteRdfList, shapeIri)).toBeInstanceOf(Error);
    });

    it(`should returns a closed Shape with multiple properties  
    given some quads representing a shape with a shape expression`, async() => {
      const shape = await shapeFromQuads(shapeWithShapeExpression, shapeIri);
      const prefix = 'http://localhost:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary';
      const expectedPredicates: string[] = [
        'http://www.w3.org/ns/pim/space#storage',
        `${prefix}/id`,
        `${prefix}/firstName`,
        `${prefix}/lastName`,
        `${prefix}/gender`,
        `${prefix}/birthday`,
        `${prefix}/locationIP`,
        `${prefix}/browserUsed`,
        `${prefix}/creationDate`,
        `${prefix}/isLocatedIn`,
        `${prefix}/speaks`,
        `${prefix}/email`,
        `${prefix}/hasInterest`,
        `${prefix}/studyAt`,
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(true);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual([]);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a Shape with a negative property', async() => {
      const shape = await shapeFromQuads(shapeWithANegativeProperty, shapeIri);
      const expectedPredicates: string[] = [
      ];
      const negativePredicates: string[] = [
        'http://example.org/state',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should returns a Shape with positive and negative properties', async() => {
      const shape = await shapeFromQuads(shapeWithInverseAndPositiveProperties, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop2',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
      ];
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
    });

    it('should handle a shape with multiple cardinalities', async() => {
      const shape = await shapeFromQuads(shapeWithMultipleCardinality, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
        'http://xmlns.com/foaf/0.1/prop5',
        'http://xmlns.com/foaf/0.1/prop6',
        'http://xmlns.com/foaf/0.1/prop7',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop2',
      ];
      const mapCardinality = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1', { min: 1, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop3', { min: 5, max: 5 }],
        [ 'http://xmlns.com/foaf/0.1/prop4', { min: 1, max: 4 }],
        [ 'http://xmlns.com/foaf/0.1/prop5', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop6', { min: 0, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop7', { min: 0, max: -1 }],
      ]);
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
      for (const predicate of (<IShape>shape).positivePredicates) {
        const expectedCardinality = mapCardinality.get(predicate);
        const cardinality = (<IShape>shape).get(predicate)?.cardinality;
        expect(cardinality).toStrictEqual(expectedCardinality);
      }
    });

    it('should handle a shape with constraints', async() => {
      const shape = await shapeFromQuads(shapeWithConstraints, shapeIri);
      const expectedPredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop1',
        'http://xmlns.com/foaf/0.1/prop2',
        'http://xmlns.com/foaf/0.1/prop3',
        'http://xmlns.com/foaf/0.1/prop4',
        'http://xmlns.com/foaf/0.1/prop5',
        'http://xmlns.com/foaf/0.1/prop6',
        'http://xmlns.com/foaf/0.1/prop7',
        'http://xmlns.com/foaf/0.1/prop8',
      ];
      const negativePredicates: string[] = [
        'http://xmlns.com/foaf/0.1/prop9',
      ];
      const mapCardinality = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1', { min: 0, max: 1 }],
        [ 'http://xmlns.com/foaf/0.1/prop2', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop3', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop4', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop5', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop6', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop7', { min: 1, max: -1 }],
        [ 'http://xmlns.com/foaf/0.1/prop8', { min: 1, max: -1 }],
      ]);

      const mapConstraint = new Map([
        [ 'http://xmlns.com/foaf/0.1/prop1',
          {
            type: ContraintType.SHAPE,
            value: [ 'http:exemple.ca/bar' ],
          },
        ],
        [ 'http://xmlns.com/foaf/0.1/prop2', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop3', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop4', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop5', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop6', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop7', undefined ],
        [ 'http://xmlns.com/foaf/0.1/prop8', undefined ],
      ]);
      expect(shape).not.toBeInstanceOf(Error);
      expect((<IShape>shape).closed).toBe(false);
      expect((<IShape>shape).negativePredicates).toStrictEqual(negativePredicates);
      expect((<IShape>shape).positivePredicates).toStrictEqual(expectedPredicates);
      expect((<IShape>shape).name).toBe(shapeIri);
      for (const predicate of (<IShape>shape).positivePredicates) {
        const expectedCardinality = mapCardinality.get(predicate);
        const expectedConstraint = mapConstraint.get(predicate);

        const resPredicate = (<IShape>shape).get(predicate);
        expect(resPredicate?.cardinality).toStrictEqual(expectedCardinality);
        expect(resPredicate?.constraint).toStrictEqual(expectedConstraint);
      }
    });

    it('should throw an error given a shape with inconsistent positive and negative properties', async() => {
      expect(
        await shapeFromQuads(shapeWithInconsistentPositiveAndNegativeProperties, shapeIri),
      ).toBeInstanceOf(Error);
    });

    it('should returns an error given the stream returns an error', async() => {
      const stream: any =
      {
        on(event: string, callback: any) {
          if (event === 'error') { return callback(new Error('foo')); }
        },
      };
      const err = await shapeFromQuads(stream, shapeIri);
      expect(err).toBeInstanceOf(Error);
      expect((<Error>err).message).toBe('foo');
    });
  });
});

function populateStream(source: string | RDF.Quad[]) {
  let quads;
  if (Array.isArray(source)) {
    quads = source;
  } else {
    quads = n3Parser.parse(readFileSync(source).toString());
  }
  return streamifyArray(quads);
}
