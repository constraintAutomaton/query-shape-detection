import { SimplePropertyObject, SimpleShape } from '../lib/types';
import { Term } from "@rdfjs/types";
import { DataFactory } from 'rdf-data-factory';
import type * as RDF from '@rdfjs/types';

const DF = new DataFactory<RDF.BaseQuad>();

const AN_OBJECT = DF.namedNode('an object');

describe('SimplePropertyObject', () => {
    describe('isAlignedWithShape', () => {
        it('should be align with a SimpleShape with the right predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: [predicate]
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(true);
        });

        it('should not be align with a SimpleShape with the wrong predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: ["wrong predicate"]
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(false);
        });

        it('should not be align with a SimpleShape with no predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: []
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(false);
        });

        it('should not be align with a SimpleShape with multiple wrong predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: ['1', '2', '3', '4']
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(false);
        });

        it('should be align with a SimpleShape with multiple right predicates', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: [predicate, predicate, predicate]
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(true);
        });

        it('should be align with a SimpleShape with the right predicates and wrong predicate starting with the right predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: [predicate, '1', '2']
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(true);
        });

        it('should be align with a SimpleShape with the right predicates and wrong predicate starting with the wrong predicate', () => {
            const predicate = 'foo';
            const object: Term = AN_OBJECT;
            const property_object = new SimplePropertyObject(predicate, object);
            const shape: SimpleShape = {
                name: "foo",
                predicates: ['1', predicate, '2']
            };
            expect(property_object.isAlignedWithShape(shape)).toBe(true);
        });
    });

    describe('hasOneAlign', () => {
        it('should return undefined given an empty queryProperties array', () => {
            const predicate = 'foo';
            const queryProperties: SimplePropertyObject[] = [];
            const shape: SimpleShape = {
                name: "foo",
                predicates: [predicate, '1', '2']
            };
            expect(SimplePropertyObject.hasOneAlign(queryProperties, shape))
                .toBeUndefined();
        });

        it('should return true given an array of properties with on align property', () => {
            const predicate = 'foo';
            const queryProperties: SimplePropertyObject[] = [new SimplePropertyObject(predicate, AN_OBJECT)];
            const shape: SimpleShape = {
                name: "foo",
                predicates: [predicate, '1', '2']
            };
            expect(SimplePropertyObject.hasOneAlign(queryProperties, shape))
                .toBe(true);
        });

        it('should return true given an array of properties with all the properties aligned', () => {
            const predicates = ['foo', 'bar', 'boo'];
            const queryProperties: SimplePropertyObject[] =
                predicates.map((predicate) => new SimplePropertyObject(predicate, AN_OBJECT))
            const shape: SimpleShape = {
                name: "foo",
                predicates: [...predicates, '1', '2']
            };
            expect(SimplePropertyObject.hasOneAlign(queryProperties, shape))
                .toBe(true);
        });

        it('should return true given an array of properties with some properties aligned', () => {
            const predicates = ['foo', 'bar', 'boo'];
            const queryProperties: SimplePropertyObject[] =
                [...predicates, 'a', 'b', 'c'].map((predicate) => new SimplePropertyObject(predicate, AN_OBJECT))
            const shape: SimpleShape = {
                name: "foo",
                predicates: [...predicates, '1', '2']
            };
            expect(SimplePropertyObject.hasOneAlign(queryProperties, shape))
                .toBe(true);
        });

        it('should return false given an array of properties with no properties aligned', () => {
            const predicates = ['foo', 'bar', 'boo'];
            const queryProperties: SimplePropertyObject[] =
                ['a', 'b', 'c'].map((predicate) => new SimplePropertyObject(predicate, AN_OBJECT))
            const shape: SimpleShape = {
                name: "foo",
                predicates: [...predicates, '1', '2']
            };
            expect(SimplePropertyObject.hasOneAlign(queryProperties, shape))
                .toBe(false);
        });
    });
});

