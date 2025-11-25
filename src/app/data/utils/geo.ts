import { LineString as LineStringTurf, Polygon as Polygonturf } from '@turf/helpers';
import * as turf from '@turf/turf';
import { Coordinate } from 'ol/coordinate';
import { LinearRing } from 'ol/geom';
import { Pixel } from 'ol/pixel';
import {
    Feature, GeoJSON, Geometry, LayerGroup, LineString, Map, MultiLineString, MultiPolygon, ol3Parser, Point, Polygon, VectorLayer,
    VectorSource
} from 'src/app/ol-module';

import * as operation from 'jsts/org/locationtech/jts/operation';

// var jsts = require('jsts')

/**
 * Function de geo
 */
export class geoHelper {

    protected map

    constructor(map: Map) {
        this.map = map
    }




    /**
     * Snaps two geometries together with a given tolerance.
     * @param geometry1 geometry jtfs
     * @param geometry2 geometry jtfs
     * @param tolerance number la distance de tolerance en m
     * @returns Geometry
     */
    snapFeatures(geometry1: any, geometry2: any, tolerance: number) {
        // var geomSnapper = new operation.overlay.snap.GeometrySnapper(geometry1)
        // var resultGeometry = this.JstsGeomToOlGeom(geomSnapper.snapTo(geometry2,tolerance))

        var geoms = operation.overlay.snap.GeometrySnapper.snap(geometry1, geometry2, tolerance)
        // if (!geoms[0].isValid() || !geoms[1].isValid() ) {
        //     alert (geoms[0].isValid() + " "+ geoms[1].isValid())
        // }
        let geometry: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geoms[0]))

        var feature1 = turf.feature(geometry)
        // return [this.JstsGeomToOlGeom(geometry1), this.JstsGeomToOlGeom(geometry2)]
        var response = [JstsGeomToOlGeom(geoms[0]), JstsGeomToOlGeom(geoms[1])]
        if (!geoms[0].isValid()) {
            response[0] = JstsGeomToOlGeom(geometry1)
        }

        if (!geoms[1].isValid()) {
            response[1] = JstsGeomToOlGeom(geometry2)
        }
        return response

    }

    /**
     * Avoir les feature les plus proche d'un feature
     * @param feature Feature
     * @param featuresToSearch Array<Feature>
     * @param terminateDistance number la distance max ou chercher
     * @return Array<Feature>
     */
    closesFeatures(feature: Feature, featuresToSearch: Array<Feature>, terminateDistance = 0.0): Array<Feature> {
        var response = []



        for (let index = 0; index < featuresToSearch.length; index++) {
            const ft = featuresToSearch[index];
            if (ft.getId() != feature.getId()) {
                var distance = operation.distance.DistanceOp.isWithinDistance(
                    olGeomToJstsGeom(ft.getGeometry()),
                    olGeomToJstsGeom(feature.getGeometry()),
                    terminateDistance
                )
                try {
                    if (distance && !this.booleanContains(feature.getGeometry(), ft.getGeometry())) {
                        response.push(ft)
                    }
                } catch (error) {
                    console.log(error, 'error')
                }
            }
        }
        return response



    }

    /**
     * Compare si la deuxième géometrie est complètement contenu dans la première géometrie,
     * Si il partage les meme bordures, la reponse sera true
     * @param geometry1 Geometry
     * @param geometry2 Geometry
     * @return boolean
     */
    booleanContains(geometry1: Geometry, geometry2: Geometry): boolean {

        let geometry1_: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geometry1))
        var feature1 = turf.feature(geometry1_)

        let geometry2_: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geometry2))
        var feature2 = turf.feature(geometry2_)

        return turf.difference(feature1, feature2) ? false : true

    }

    /**
     * Savoir si 2 géometries sont identiques, si elles sont identiques => true
      * @param geometry1 Geometry
     * @param geometry2 Geometry
     * @return boolean
     */

    booleanEqual(geometry1: Geometry, geometry2: Geometry): boolean {
        let geometry1_: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geometry1))

        var feature1 = turf.feature(geometry1_)
        let geometry2_: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geometry2))

        var feature2 = turf.feature(geometry2_)

        return turf.booleanEqual(feature1, feature2)

    }



    /**
     * Verifier si plusieurs features sont valides, si une seule ne l'est pas => false
     * @param features Array<Feature>
     * @return boolean
     */
    booleanAllFeaturesValid(features): boolean {
        var bool = true
        for (let index = 0; index < features.length; index++) {
            const element = features[index];
            if (!booleanIsvalid(element.getGeometry())) {
                // alert(element.getId())
                bool = false
                break
            }
        }
        return bool
    }


    /**
     *  si la deuxième géometrie est complètement contenu dans la première géometrie => true,
     * Si il partage les meme bordures, la reponse sera true
     * @param geometry1 Geometry ol geometry 1
     * @param geometry2 Geometry ol geometry 1
     * @returns Boolean
     */
    booleanContainsJSTS(geometry1: Geometry, geometry2: Geometry): Boolean {
        let disjoint_res = operation.overlay.OverlayOp.difference(
            olGeomToJstsGeom(geometry1),
            olGeomToJstsGeom(geometry2)
        )

        if (disjoint_res.isEmpty()) {
            return true
        }

        return false
    }

    /**
     * Si un feature intersecte un des features
     * @param feature 
     * @param features 
     */
    booleanFeatureIntersectWithOthers(feature: Feature, features: Array<Feature>) {
        try {
            for (let index = 0; index < features.length; index++) {
                const feature1 = features[index]
                var disjoint_res = operation.overlay.OverlayOp.intersection(
                    olGeomToJstsGeom(feature1.getGeometry()),
                    olGeomToJstsGeom(feature.getGeometry()))
                // if ( feature.getGeometry().getType() != 'Polygon' && feature.getGeometry().getType() != 'MultiPolygon' &&  disjoint_res.getLength() > 0 && disjoint_res.getArea() == 0) {
                //     return true
                // }

                if (!disjoint_res.isEmpty() && disjoint_res.getArea() > 1) {
                    return true
                }
            }
            return false
        } catch (error) {
            return true
        }
    }



    /**
     * recuperer tous les id des features d'un layer
     * @param source VectorSource
     * @return Array<string>
     */
    public static listIdFromSource(source: VectorSource): Array<string> {
        var response = []
        for (let index = 0; index < source.getFeatures().length; index++) {
            const feat = source.getFeatures()[index];
            response.push(feat.getId())
        }
        return response
    }

    /**
     * Fermer une géometrie issu de l'interaction draw
     * @param type 'point'|'polygon'|'linestring'
     * @param coordinates Array<any>
     * @returns Geometry
     */
    closeGeometryOfDrawInteraction(type: 'point' | 'polygon' | 'linestring' | string, coordinates: Array<any>): Geometry {
        let geometry: Geometry
        if (type == 'polygon') {



            var coordinates1 = JSON.parse(JSON.stringify(coordinates))
            coordinates1[0].splice(coordinates1[0].length - 1, 1)

            coordinates1[0].unshift(coordinates1[0][coordinates1[0].length - 1])
            geometry = new Polygon(coordinates1)

        } else {
            if (type == 'linestring') {
                geometry = new LineString(coordinates)
            } else if (type == 'point') {
                geometry = new Point(coordinates)
            }
        }

        return geometry
    }

    /**
     * merge multiple feature's geometry and return one geometry of type Multy
     * Make sure all your geometry have same type Point, Polygon or LineString
     * @param features Feature[]
     * @param type 'point' | 'polygon' | 'linestring' geometry type of all features
     * @retun Geometry
     */
    mergeFeatureGeometrys(features: Feature[], type: 'polygon'): Geometry {
        let multiGeometry;

        if (type == 'polygon') {
            multiGeometry = new MultiPolygon([])
        }

        for (let index = 0; index < features.length; index++) {
            let geometry = features[index].getGeometry()
            if (geometry instanceof MultiPolygon) {
                for (let j = 0; j < geometry.getPolygons().length; j++) {
                    multiGeometry.appendPolygon(geometry.getPolygons()[j])
                }
            } else {
                multiGeometry.appendPolygon(geometry)
            }
        }

        return multiGeometry
    }

    /**
     * Décompose un multipolygon en plusieurs polygones
     * @param geometry 
     * @returns Array<Polygon>
     */
    getAllPolygonsFromMultipolygonOl(geometry: Geometry): Array<Polygon> {
        if (geometry instanceof MultiPolygon) {
            return geometry.getPolygons()
        } else if (geometry instanceof Polygon) {
            return [geometry]
        }
        return null
    }

    /**
     * Calculate a buffer of a openlayer geometry
     * @param geometry Geometry
     * @param distance number distance of the buffer in meters
     * @return Geometry
     */
    buffer(geometry: Geometry, distance: number): Geometry {
        let bufferGeometry = geometry
        try {
            bufferGeometry = JstsGeomToOlGeom(olGeomToJstsGeom(geometry).buffer(distance))

        } catch (error) {
            // this.olGeomToJstsGeom(geometry)
            // let turfFeature:turf.Feature<MultiPolygon> = this.olGeomToTurfFeature(geometry)
            // polygon.geometry = turfFeature.geometry
            // var buffered = turf.buffer(polygon, 500, {units: 'miles'});
            console.error(error)
        }
        return bufferGeometry
    }

}

// coordinates; will return the length of the [a, b] segment
export function length(a, b) {
    return Math.sqrt(
        (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])
    );
}

// coordinates; will return true if c is on the [a, b] segment
export function isOnSegment(c, a, b) {
    var lengthAc = length(a, c);
    var lengthAb = length(a, b);
    var dot =
        ((c[0] - a[0]) * (b[0] - a[0]) + (c[1] - a[1]) * (b[1] - a[1])) / lengthAb;
    return Math.abs(lengthAc - dot) < 1e-6 && lengthAc < lengthAb;
}

// modulo for negative values, eg: mod(-1, 4) returns 3
export function mod(a, b) {
    return ((a % b) + b) % b;
}

// returns a coordinates array which contains the segments of the feature's
// outer ring between the start and end points
// Note: this assumes the base feature is a single polygon
export function getPartialRingCoordsFromPolygon(feature: Feature<Polygon | MultiPolygon>, startPoint: Coordinate, endPoint: Coordinate): Array<Coordinate> {
    var polygon_ = feature.getGeometry();
    var polygon: Polygon
    if (polygon_ instanceof MultiPolygon) {
        polygon = polygon_.getPolygon(0);
    } else {
        polygon = polygon_
    }
    var ringCoords = polygon.getLinearRing(0).getCoordinates();
    if (polygon.getLinearRingCount() > 1) {
        ringCoords = ringCoords.concat(polygon.getLinearRing(1).getCoordinates())
    }

    var i,
        pointA,
        pointB,
        startSegmentIndex = -1;
    for (i = 0; i < ringCoords.length; i++) {
        pointA = ringCoords[i];
        pointB = ringCoords[mod(i + 1, ringCoords.length)];

        // check if this is the start segment dot product
        if (isOnSegment(startPoint, pointA, pointB)) {
            startSegmentIndex = i;
            break;
        }
    }

    var cwCoordinates = [];
    var cwLength = 0;
    var ccwCoordinates = [];
    var ccwLength = 0;

    // build clockwise coordinates
    for (i = 0; i < ringCoords.length; i++) {
        pointA =
            i === 0
                ? startPoint
                : ringCoords[mod(i + startSegmentIndex, ringCoords.length)];
        pointB = ringCoords[mod(i + startSegmentIndex + 1, ringCoords.length)];
        cwCoordinates.push(pointA);

        if (isOnSegment(endPoint, pointA, pointB)) {
            cwCoordinates.push(endPoint);
            cwLength += length(pointA, endPoint);
            break;
        } else {
            cwLength += length(pointA, pointB);
        }
    }

    // build counter-clockwise coordinates
    for (i = 0; i < ringCoords.length; i++) {
        pointA = ringCoords[mod(startSegmentIndex - i, ringCoords.length)];
        pointB =
            i === 0
                ? startPoint
                : ringCoords[mod(startSegmentIndex - i + 1, ringCoords.length)];
        ccwCoordinates.push(pointB);

        if (isOnSegment(endPoint, pointA, pointB)) {
            ccwCoordinates.push(endPoint);
            ccwLength += length(endPoint, pointB);
            break;
        } else {
            ccwLength += length(pointA, pointB);
        }
    }

    // keep the shortest path
    return ccwLength < cwLength ? ccwCoordinates : cwCoordinates;
}


// returns a coordinates array which contains the segments of the feature's
// outer ring between the start and end points
// Note: this assumes the base feature is a single polygon
export function getPartialRingCoordsFromLinstring(feature: Feature<LineString | MultiLineString>, startPoint: Coordinate, endPoint: Coordinate): Array<Coordinate> {

    let allCoordinates: Array<Coordinate> = []
    let geometry = feature.getGeometry()
    if (geometry instanceof MultiLineString) {
        geometry.getLineStrings().map((line) => {
            line.getCoordinates().map((item) => allCoordinates.push(item))
        })
    } else {
        geometry.getCoordinates().map((item) => allCoordinates.push(item))
    }

    var ringCoords = allCoordinates;

    var i,
        pointA,
        pointB,
        startSegmentIndex = -1;
    for (i = 0; i < ringCoords.length; i++) {
        pointA = ringCoords[i];
        pointB = ringCoords[mod(i + 1, ringCoords.length)];

        // check if this is the start segment dot product
        if (isOnSegment(startPoint, pointA, pointB)) {
            startSegmentIndex = i;
            break;
        }
    }

    var cwCoordinates = [];
    var cwLength = 0;
    var ccwCoordinates = [];
    var ccwLength = 0;

    // build clockwise coordinates
    for (i = 0; i < ringCoords.length; i++) {
        pointA =
            i === 0
                ? startPoint
                : ringCoords[mod(i + startSegmentIndex, ringCoords.length)];
        pointB = ringCoords[mod(i + startSegmentIndex + 1, ringCoords.length)];
        cwCoordinates.push(pointA);

        if (isOnSegment(endPoint, pointA, pointB)) {
            cwCoordinates.push(endPoint);
            cwLength += length(pointA, endPoint);
            break;
        } else {
            cwLength += length(pointA, pointB);
        }
    }

    // build counter-clockwise coordinates
    for (i = 0; i < ringCoords.length; i++) {
        pointA = ringCoords[mod(startSegmentIndex - i, ringCoords.length)];
        pointB =
            i === 0
                ? startPoint
                : ringCoords[mod(startSegmentIndex - i + 1, ringCoords.length)];
        ccwCoordinates.push(pointB);

        if (isOnSegment(endPoint, pointA, pointB)) {
            ccwCoordinates.push(endPoint);
            ccwLength += length(endPoint, pointB);
            break;
        } else {
            ccwLength += length(pointA, pointB);
        }
    }

    // keep the shortest path
    return ccwLength < cwLength ? ccwCoordinates : cwCoordinates;
}

export function getAllPointsOfPolygon(geometry: Polygon | MultiPolygon): Array<Coordinate> {
    let allCoordinates: Array<Coordinate> = []
    let linearRing: LinearRing[] = []

    if (geometry instanceof MultiPolygon) {
        geometry.getPolygons().map((polygon) => {
            polygon.getLinearRings().map((item) => linearRing.push(item))
        })
    } else {
        geometry.getLinearRings().map((item) => linearRing.push(item))
    }


    linearRing.map((ring) => {
        allCoordinates = allCoordinates.concat(ring.getCoordinates())
    })

    return allCoordinates
}

export function getAllPointsOfLinestring(geometry: LineString | MultiLineString): Array<Coordinate> {
    let allCoordinates: Array<Coordinate> = []

    if (geometry instanceof MultiLineString) {
        geometry.getLineStrings().map((line) => {
            line.getCoordinates().map((item) => allCoordinates.push(item))
        })
    } else {
        geometry.getCoordinates().map((item) => allCoordinates.push(item))
    }

    return allCoordinates
}

export function getClosesPointsOfPolygon(allPolygonCoordinates: Array<Coordinate>, point: Coordinate): {
    pointA: Coordinate
    pointB: Coordinate
} {
    var i,
        pointA,
        pointB,
        startSegmentIndex = -1;

    for (i = 0; i < allPolygonCoordinates.length; i++) {
        pointA = allPolygonCoordinates[i];
        pointB = allPolygonCoordinates[mod(i + 1, allPolygonCoordinates.length)];

        // check if this is the start segment dot product
        if (isOnSegment(point, pointA, pointB)) {
            startSegmentIndex = i;
            break;
        }
    }

    return {
        pointA: pointA,
        pointB: pointB
    }
}

/**
 * return the distance between two points.
 *
 * @param {number} x1		x position of first point
 * @param {number} y1		y position of first point
 * @param {number} x2		x position of second point
 * @param {number} y2		y position of second point
 * @return {number} 		distance between given points
 */
export function getDistanceBetweenPixels(A: Pixel, B: Pixel): number {
    let x1 = A[0]
    let y1 = A[1]

    let x2 = B[0]
    let y2 = B[1]

    var xs = x2 - x1,
        ys = y2 - y1;

    xs *= xs;
    ys *= ys;

    return Math.sqrt(xs + ys);
};

/**
  * Cette geoemtrie est elle valide ?
  *  @param geometry Geometry
  * @return boolean
  */
export function booleanIsvalid(geometry: Geometry): boolean {
    try {


        var clean_geometry = tufFeatureToOlGeom(turf.cleanCoords(olGeomToTurfFeature(geometry)))

        var jstsGeometry = olGeomToJstsGeom(clean_geometry)
        var validOperation = new operation.valid.IsValidOp(jstsGeometry)
        // validOperation.setSelfTouchingRingFormingHoleValid(true)

        // if (!validOperation.isValid()) {
        // let geometry1_: any = new GeoJSON().writeGeometryObject(JstsGeomToOlGeom(geometry))

        // var feature1 = turf.feature(geometry1_)
        // return false
        // }
        // Erreur général : validOperation.getValidationError().getMessage()
        // Erreur avec les détails, coordonnées ou est l'eerur :validOperation.getValidationError().toString()
        return validOperation.isValid()
        // return true
    } catch (error) {
        console.error(error)
        return false
    }
}


/**
 * Y'a til des supoperposition entre ces features ?
 * @param features 
 * @return boolean
 */
export function booleanAllFeaturesIntersection(features: Array<Feature>): boolean {
    try {
        for (let index = 0; index < features.length; index++) {
            const feature1 = features[index]

            for (let jndex = 0; jndex < features.length; jndex++) {
                const feature2 = features[jndex]
                if (feature1.getId() != feature2.getId()) {
                    //     var geom1 = new jsts.geom.Geometry(this.olGeomToJstsGeom(feature1.getGeometry()))
                    //    var disjoint_res= geom1.intersects(this.olGeomToJstsGeom(feature2.getGeometry()))
                    var disjoint_res = operation.overlay.OverlayOp.intersection(
                        olGeomToJstsGeom(feature1.getGeometry()),
                        olGeomToJstsGeom(feature2.getGeometry()))
                    //    if (disjoint_res.getLength() > 1) {
                    //    }

                    if (!disjoint_res.isEmpty() && disjoint_res.getArea() > 1) {
                        return true
                    }
                }

            }
        }
        return false
    } catch (error) {
        return true
    }
}


/**
* ol geometry to turf feature
* @param geometry Geometry
* @return turf.Feature
*/
export function olGeomToTurfFeature<T>(geometry: Geometry): turf.Feature<T> {
    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry)

    var feature = turf.feature(geometry1_)
    return feature
}

/**
 * Turf feature to ol geom
 * @param feature turf.Feature
 * @return T
 */
export function tufFeatureToOlGeom<T extends Geometry>(feature: turf.Feature): T {
    let a: any = new GeoJSON().readGeometry(feature.geometry)
    let ft = new Feature<T>()
    ft.setGeometry(a)
    return ft.getGeometry()
}

/**
  * Convertir une géometrie d'openlayer à une géometrie de jsts
  * @param geometry Geometry
  * @return geometry de type jsts
  */
export function olGeomToJstsGeom(geometry: Geometry): any {
    return ol3Parser.read(geometry)
}


/**
* Convertir une géometrie d'openlayer à une géometrie de jsts
* @param geometry Geometry
* @return geometry de type jsts
*/
export function JstsGeomToOlGeom(geometry: Geometry): any {
    return ol3Parser.write(geometry)
}

/**
 * Get the layer of a feature
 * @param map Map
 * @param feature Feature<Geometry>
 * @returns VectorLayer
 */
export function getLayerFromFeature(map: Map, feature: Feature<Geometry>) {
    var this_ = feature
    // let layer_: VectorLayer
    let layer_: any

    let layersToLookFor = [];
    /**
     * Populates array layersToLookFor with only
     * layers that have features
     */
    var check = function (layer) {
        var source = layer.getSource();
        if (source instanceof VectorSource) {
            var features = source.getFeatures();
            if (features.length > 0) {
                layersToLookFor.push({
                    layer: layer,
                    features: features
                });
            }
        }
    };
    //loop through map layers
    map.getLayers().forEach(function (layer) {
        if (layer instanceof LayerGroup) {
            layer.getLayers().forEach(check);
        } else {
            check(layer);
        }
    });
    layersToLookFor.forEach(function (obj) {
        var found = obj.features.some(function (feature) {
            return this_ === feature;
        });
        if (found) {
            //this is the layer we want
            layer_ = obj.layer;
        }
    });
    return layer_;
};

/**
 * Difference between 2 geometrys
 * @param feature Feature<Polygon|MultiPolygon>
 * @param geometry Polygon|MultiPolygon
 * @returns Polygon|MultiPolygon
 */
export function differenceBetweenGeometry(geometry1: Polygon | MultiPolygon, geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
    let disjoint_res = operation.overlay.OverlayOp.difference(
        olGeomToJstsGeom(geometry1),
        olGeomToJstsGeom(geometry)
    )
    if (disjoint_res.isEmpty()) {
        return undefined
    }
    return JstsGeomToOlGeom(disjoint_res)
}

/**
 * Est ce que la géometrie2 est contenu dans la géométrie1 ?
 * Si l'intersection entre les 2 est un point => il renvera faux
 * NB: ne pas utiliser geomety2 comme un point, créer une autre fonction pour cela 
 * @param geometry1 
 * @param geometry2 
 * @returns 
 */
export function booleanContains(geometry1: Geometry, geometry2: Geometry): boolean {

    let disjoint_res = operation.overlay.OverlayOp.intersection(
        olGeomToJstsGeom(geometry1),
        olGeomToJstsGeom(geometry2)
    )
    if (disjoint_res.isEmpty() || disjoint_res.getGeometryType()==='Point') {
        return false
    }

    return true
}

/**
 * Est ce que le polygon 2 a une partie contenu dans la polygon 1 ?
 * Si l'intersection entre les 2 est un point ou une ligne => il renvera faux
 * @param polygon1 
 * @param polygon2 
 * @returns 
 */
 export function booleanContainsPolygon(polygon1: Polygon|MultiPolygon, polygon2: Polygon|MultiPolygon) {

    let disjoint_res = operation.overlay.OverlayOp.intersection(
        olGeomToJstsGeom(polygon1),
        olGeomToJstsGeom(polygon2)
    )
    
    if (disjoint_res.isEmpty() || disjoint_res.getGeometryType()==='Point' || disjoint_res.getGeometryType()==='MultiLineString' || disjoint_res.getGeometryType()==='LineString') {
        return false
    }
    return JstsGeomToOlGeom(disjoint_res)
    // return true
}

/**
 * Compare si la deuxième géometrie est complètement contenu dans la première géometrie,
 * @param geometry1 Geometry
 * @param geometry2 Geometry
 * @return boolean
 */
export function booleanContainsTurf(geometry1: Geometry, geometry2: Geometry) : boolean {

    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    var feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    var feature2 = turf.feature(geometry2_)

    return turf.booleanContains(feature1, feature2)

}


/**
 * Découper le deuxième polygone par la première. Si il y a une entité résultant
 * de la découpe, cela retourne faux
 * @param geometry1 
 * @param geometry2 
 * @returns boolean
 */
export function booleanDifferenceTurf(geometry1: Geometry, geometry2: Geometry) : boolean {
    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    var feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    var feature2 = turf.feature(geometry2_)
    return turf.difference(feature1, feature2) ? false : true
}
/**
 * Compare si la première géometrie est complètemenet dans la deuxième géometrie
 * @param geometry1 
 * @param geometry2
 * @returns Boolean
 */
export function booleanWithinTurf(geometry1: Geometry, geometry2: Geometry): boolean {

    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    var feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    var feature2 = turf.feature(geometry2_)

    return turf.booleanWithin(feature1, feature2)
}

export function booleanLineSplit(geometry1: Geometry, geometry2: Geometry): boolean {

    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    let feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    let feature2 = turf.feature(geometry2_)

    let lineSplited = turf.lineSplit(feature1, feature2)
    return false
}
/**
 * Comparer si le point (geometry1) est compris dans le polygone (geometry2)
 * @param geometry1 Point
 * @param geometry2 Polygone
 * @returns boolean
 */
export function booleanPointsWithinPolygonTurf(geometry1: Geometry, geometry2: Geometry) : boolean {
    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    var feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    var feature2 = turf.feature(geometry2_)

    let innerFeature = turf.pointsWithinPolygon(feature1, feature2)
    return innerFeature.features.length > 0 ? true : false
}

/**
 * Compare si les deux géometries se touchent
 * @param geometry1 Geometry
 * @param geometry2 Geometry
 * @returns boolean
 */
export function booleanIntersectsTurf(geometry1: Geometry, geometry2: Geometry): boolean {

    let geometry1_: any = new GeoJSON().writeGeometryObject(geometry1)
    var feature1 = turf.feature(geometry1_)

    let geometry2_: any = new GeoJSON().writeGeometryObject(geometry2)
    var feature2 = turf.feature(geometry2_)

    return turf.intersect(feature1, feature2) ? true : false

}

export function splitGeometrys<T>(geometry1: any, geometry2: LineString): Array<T> {
    try {
        let poly = olGeomToJstsGeom(geometry1)
        let line = olGeomToJstsGeom(geometry2)
        //Perform union of Polygon and Line and use Polygonizer to split the polygon by line
        
        if (poly.getNumInteriorRing() > 0 ) {
            return undefined
        }
        let union = poly.getExteriorRing().union(line);
        let polygonizer = new operation.polygonize.Polygonizer();

        //Splitting polygon in two part
        polygonizer.add(union);

        //Get splitted polygons
        let geometrysSlipted: Array<any> = polygonizer.getPolygons().array;

        return geometrysSlipted.map((geom) => JstsGeomToOlGeom(geom))
    } catch (error) {
        console.error(error)
        return undefined
    }

}

/**
 * Takes a line and returns a line at offset by the specified distance.
 * https://turfjs.org/docs/#lineOffset
 * @param lineGeometry 
 * @param distance distance en mètre
 * @returns LineString|MultiLineString
 */
export function LineOffset(lineGeometry:LineString , distance:number):LineString {
    return tufFeatureToOlGeom(turf.lineOffset(olGeomToTurfFeature<LineStringTurf>(lineGeometry), distance*1000000, {units:'meters'}))
}

/**
 * Merge two polygons, return a polygon or multipolygon
 * @param polygon1 Polygon
 * @param polygon2 Polygon
 * @returns Polygon|MultiPolygon
 */
export function mergePolygons(polygon1:Polygon|MultiPolygon, polygon2:Polygon|MultiPolygon):Polygon|MultiPolygon{
    return tufFeatureToOlGeom<Polygon|MultiPolygon>(turf.union(olGeomToTurfFeature<Polygonturf>(polygon1), olGeomToTurfFeature<Polygonturf>(polygon2)))
}

/**
 * get centroid of a ol geometry
 * @param geometry Geometry
 * @returns 
 */
export function getPointOnFeature(geometry:Geometry):Point{
    return tufFeatureToOlGeom(turf.pointOnFeature(olGeomToTurfFeature(geometry)))
}