import { TemplateRef } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Collection, Map, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { pointerMove } from "ol/events/condition";
import { MultiPoint } from "ol/geom";
import { Modify, Select, Snap } from "ol/interaction";
import { ModifyEvent } from "ol/interaction/Modify";
import { SelectEvent } from "ol/interaction/Select";
import { Pixel } from "ol/pixel";
import { Fill, RegularShape, Stroke, Style } from "ol/style";
import { fromEvent, Observable, ReplaySubject, Subscriber } from "rxjs";
import { filter, takeUntil, tap } from "rxjs/operators";
import { booleanAllFeaturesIntersection, booleanContainsPolygon, booleanIsvalid, differenceBetweenGeometry, getAllPointsOfLinestring, getAllPointsOfPolygon, getClosesPointsOfPolygon, getDistanceBetweenPixels, getLayerFromFeature, getPartialRingCoordsFromLinstring, getPartialRingCoordsFromPolygon } from "src/app/data/utils/geo";
import { CircleStyle, Feature, LineString, MultiLineString, MultiPolygon, Point, Polygon, unByKey, VectorLayer, VectorSource, Geometry } from "src/app/ol-module";
import { FeatureStatus, LayerToDigitalise } from "../../../data/models/layer-to-digitalise";
import { updateGeometryFeature } from "./featureCrud";


export class UpdateGeometry {

    private updateLayer: VectorLayer<VectorSource<Geometry>>
    // private updateLayer: any
    private selectInteraction: Select
    private modifyInteraction: Modify
    private snapInteraction: Snap
    private snapInteractionWithEdge: Snap

    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    isEnable: boolean = false
    /**
     * editer plusieurs géométries à la fois ?
     */
    private multipleEdit: boolean = true

    /**
     * is the user is modifying the geometry of a feature ?
     * Utilisé pour empecher la selection/déselection d'autres entités pendant l'édition géométrique
     */
    private isModifying_: boolean = false
    private featuresInEdition_: { properties: any, id: string | number }[] = []

    constructor(
        public map: Map,
        public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
        public layersToDigitalise: Array<LayerToDigitalise>,
        public notifier: NotifierService,
        public customNotificationTmpl: TemplateRef<HTMLElement>,
        public tranlate: TranslateService
    ) {

        this.isEnable = false

        this.updateLayer = new VectorLayer({
            source: new VectorSource(),
            style: (feature: Feature): Style => {
                var type = feature.getGeometry().getType()
                var style: Style;
                if (type == 'Point' || type == 'MultiPoint') {
                    style = new Style({
                        image: new CircleStyle({
                            radius: 7,
                            fill: new Fill({
                                color: [255, 0, 0, 0.5]
                            }),
                            stroke: new Stroke({ color: 'rgba(0,0,0,1)', width: 3 }),
                        }),
                        zIndex: 100000
                    })
                } else if (type == 'LineString' || type == 'MultiLineString') {
                    style = new Style({
                        stroke: new Stroke({
                            color: 'rgba(255,0,0,0.5)',
                            width: 8
                        }),
                        zIndex: 100000
                    })

                } else if (type == 'Polygon' || type == 'MultiPolygon') {
                    style = new Style({
                        fill: new Fill({
                            color: 'rgba(255,0,0,0.1)',
                        }),
                        stroke: new Stroke({
                            color: 'rgba(255,0,0,0.5)',
                            width: 5,
                            lineDash: [40, 20, 15, 20],
                            lineCap: 'round'
                            // lineDashOffset: 40
                        }),
                        zIndex: 100000
                    })
                }
                return style
            },
            zIndex: 99,
        })

        this.selectInteraction = new Select({
            multi: this.multipleEdit,
            layers: this.editableLayers,
            condition: (evt: MapBrowserEvent<PointerEvent>) => {
                if (!this.isModifying_) {
                    return pointerMove(evt)
                } else {
                    return false
                }
            },
            style: (feature: Feature): Style | Style[] => {
                var type = feature.getGeometry().getType()
                var style: Style | Style[];
                if (type == 'Point' || type == 'MultiPoint') {
                    style = new Style({
                        image: new CircleStyle({
                            radius: 4,
                            stroke: new Stroke({ color: 'rgba(255,0,0,0.4)', width: 6 }),
                            fill: new Fill({
                                color: 'rgba(0,0,0,0.7)',
                            }),
                        }),
                        zIndex: 1000001
                    })
                } else if (type == 'LineString' || type == 'MultiLineString') {
                    style = [
                        new Style({
                            stroke: new Stroke({
                                color: 'rgba(255,0,0,0.4)',
                                width: 6
                            }),
                            zIndex: 1000001
                        }),
                        new Style({
                            image: new CircleStyle({
                                radius: 4,
                                stroke: new Stroke({ color: 'rgba(255,0,0,0.4)', width: 6 }),
                                fill: new Fill({
                                    color: 'rgba(0,0,0,0.7)',
                                }),
                            }),
                            geometry: function (feature: Feature<LineString | MultiLineString>) {
                                feature.getGeometry()
                                let coordinates: Array<Coordinate> = getAllPointsOfLinestring(feature.getGeometry())
                                return new MultiPoint(coordinates);
                            },
                            zIndex: 1000001
                        })
                    ]
                } else if (type == 'Polygon' || type == 'MultiPolygon') {
                    let initStyle = getLayerFromFeature(this.map, feature).getStyleFunction()(feature, 0) as Style
                    style = [
                        new Style({
                            fill: initStyle.getFill() ? new Fill({
                                color: 'rgba(255,0,0,0.4)',
                            }) : null,
                            stroke: new Stroke({ color: 'rgba(0,0,0,0.4)' }),
                            zIndex: 1000
                        }),
                        new Style({
                            image: new CircleStyle({
                                radius: 4,
                                stroke: new Stroke({ color: 'rgba(255,0,0,0.4)', width: 6 }),
                                fill: new Fill({
                                    color: 'rgba(0,0,0,0.7)',
                                }),
                            }),
                            geometry: function (feature: Feature<Polygon>) {
                                let coordinates: Array<Coordinate> = getAllPointsOfPolygon(feature.getGeometry())
                                return new MultiPoint(coordinates);
                            },
                            zIndex: 1000
                        })
                    ]
                }

                return style
            }
        });

        this.modifyInteraction = new Modify({
            source: this.updateLayer.getSource(),
            pixelTolerance: 27,
            condition: (evt: MapBrowserEvent<UIEvent>) => {
                let response: boolean = false
                if (this.updateLayer.getSource().getFeatures().length == 0) {
                    return false
                }
                let featureOnModify = this.updateLayer.getSource().getFeatures()[0]
                if (this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof LineString || feature.getGeometry() instanceof MultiLineString).length > 0) {
                    featureOnModify = this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof LineString || feature.getGeometry() instanceof MultiLineString)[0]
                }
                else if (this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof Point || feature.getGeometry() instanceof MultiPoint).length > 0) {
                    featureOnModify = this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof Point || feature.getGeometry() instanceof MultiPoint)[0]
                }
                let geometryOnModify = featureOnModify.getGeometry()

                let featuresAtPixel = this.map.getFeaturesAtPixel(evt.pixel, {
                    hitTolerance: 5
                })

                let features = featuresAtPixel.filter((feature) => {

                    return this.updateLayer.getSource().getFeatureById(featureOnModify.getId()) != undefined
                })

                features.forEach((feature: Feature<Point>) => {
                    // let geometry: MultiPolygon | Polygon = feature.get('features')[0].getGeometry()
                    if (geometryOnModify instanceof MultiPolygon || geometryOnModify instanceof Polygon) {

                        let geometry: MultiPolygon | Polygon = geometryOnModify

                        let allCoordinates: Array<Coordinate> = getAllPointsOfPolygon(geometry)
                        let start_end = getClosesPointsOfPolygon(allCoordinates, feature.getGeometry().getCoordinates())
                        let pointA = start_end.pointA
                        let pointB = start_end.pointB

                        let pixelFeatureO: Pixel = this.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates())
                        let pixelPointA: Pixel = this.map.getPixelFromCoordinate(pointA)
                        let pixelPointB: Pixel = this.map.getPixelFromCoordinate(pointB)

                        let polygonFeature = new Feature(geometry)
                        polygonFeature.setGeometry(geometry)
                        let vertex = new LineString(getPartialRingCoordsFromPolygon(polygonFeature, pointA, pointB))
                        let vertexMiddle = new Point(vertex.getFlatMidpoint())

                        let pixelVertexMiddle: Pixel = this.map.getPixelFromCoordinate(vertexMiddle.getCoordinates())

                        if (getDistanceBetweenPixels(pixelFeatureO, pixelPointA) <= 5 || getDistanceBetweenPixels(pixelFeatureO, pixelPointB) <= 5 || getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) <= 5) {
                            response = true
                            return
                        }
                    } else if (geometryOnModify instanceof MultiLineString || geometryOnModify instanceof LineString) {
                        let geometry: MultiLineString | LineString = geometryOnModify
                        let allCoordinates: Array<Coordinate> = getAllPointsOfLinestring(geometry)
                        let start_end = getClosesPointsOfPolygon(allCoordinates, feature.getGeometry().getCoordinates())
                        let pointA = start_end.pointA
                        let pointB = start_end.pointB

                        let pixelFeatureO: Pixel = this.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates())
                        let pixelPointA: Pixel = this.map.getPixelFromCoordinate(pointA)
                        let pixelPointB: Pixel = this.map.getPixelFromCoordinate(pointB)


                        let linestringFeature = new Feature(geometry)
                        linestringFeature.setGeometry(geometry)
                        let vertex = new LineString(getPartialRingCoordsFromLinstring(linestringFeature, pointA, pointB))
                        let vertexMiddle = new Point(vertex.getFlatMidpoint())

                        let pixelVertexMiddle: Pixel = this.map.getPixelFromCoordinate(vertexMiddle.getCoordinates())

                        if (getDistanceBetweenPixels(pixelFeatureO, pixelPointA) <= 5 || getDistanceBetweenPixels(pixelFeatureO, pixelPointB) <= 5 || getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) <= 5) {
                            response = true
                            return
                        }

                    } else if (geometryOnModify instanceof MultiPoint || geometryOnModify instanceof Point) {
                        response = true
                        return
                    }
                });

                return response
            },
            style: (feature: Feature<Point>): Style | Style[] => {

                try {

                    // let geometry: MultiPolygon | Polygon = feature.get('features')[0].getGeometry()
                    let featureOnModify = this.updateLayer.getSource().getFeatures()[0]

                    if (this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof LineString || feature.getGeometry() instanceof MultiLineString).length > 0) {
                        featureOnModify = this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof LineString || feature.getGeometry() instanceof MultiLineString)[0]
                    } else if (this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof Point || feature.getGeometry() instanceof MultiPoint).length > 0) {
                        featureOnModify = this.updateLayer.getSource().getFeatures().filter((feature) => feature.getGeometry() instanceof Point || feature.getGeometry() instanceof MultiPoint)[0]
                    }

                    let geometryOnModify = featureOnModify.getGeometry()

                    if (geometryOnModify instanceof MultiPolygon || geometryOnModify instanceof Polygon) {

                        let geometry: MultiPolygon | Polygon = geometryOnModify
                        let allCoordinates: Array<Coordinate> = getAllPointsOfPolygon(geometry)
                        let start_end = getClosesPointsOfPolygon(allCoordinates, feature.getGeometry().getCoordinates())
                        let pointA = start_end.pointA
                        let pointB = start_end.pointB

                        let pixelFeatureO: Pixel = this.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates())
                        let pixelPointA: Pixel = this.map.getPixelFromCoordinate(pointA)
                        let pixelPointB: Pixel = this.map.getPixelFromCoordinate(pointB)

                        let polygonFeature = new Feature(geometry)
                        polygonFeature.setGeometry(geometry)
                        let vertex = new LineString(getPartialRingCoordsFromPolygon(polygonFeature, pointA, pointB))
                        let vertexMiddle = new Point(vertex.getFlatMidpoint())

                        let pixelVertexMiddle: Pixel = this.map.getPixelFromCoordinate(vertexMiddle.getCoordinates())

                        return [
                            new Style({
                                image: new CircleStyle({
                                    radius: 6,
                                    stroke: new Stroke({ color: 'rgba(0,0,0,0.7)', width: 3 }),
                                    fill: new Fill({
                                        color: 'rgba(0,0,0,0)',
                                    }),
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelPointA) <= 5) {
                                        return new Point(pointA)
                                    } else if (getDistanceBetweenPixels(pixelFeatureO, pixelPointB) <= 5) {
                                        return new Point(pointB)
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                image: new RegularShape({
                                    fill: new Fill({ color: 'rgba(0,0,0,0.7)' }),
                                    stroke: new Stroke({ color: 'rgba(0,0,0,1)' }),
                                    points: 4,
                                    radius: 8,
                                    radius2: 0,
                                    angle: 0,
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) <= 5) {
                                        return vertexMiddle
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                image: new RegularShape({
                                    fill: new Fill({ color: 'rgba(255,0,0,0.7)' }),
                                    stroke: new Stroke({ color: 'rgba(255,0,0,1)' }),
                                    points: 4,
                                    radius: 5,
                                    radius2: 0,
                                    angle: 0,
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) > 5) {
                                        return vertexMiddle
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                stroke: new Stroke({ color: 'rgba(255,0,0,0.3)', width: 8 }),
                                geometry: function (feature: Feature) {
                                    return vertex;
                                },
                            })
                        ]

                    } else if (geometryOnModify instanceof MultiLineString || geometryOnModify instanceof LineString) {
                        let geometry: MultiLineString | LineString = geometryOnModify
                        let allCoordinates: Array<Coordinate> = getAllPointsOfLinestring(geometry)
                        let start_end = getClosesPointsOfPolygon(allCoordinates, feature.getGeometry().getCoordinates())
                        let pointA = start_end.pointA
                        let pointB = start_end.pointB
                        let pixelFeatureO: Pixel = this.map.getPixelFromCoordinate(feature.getGeometry().getCoordinates())
                        let pixelPointA: Pixel = this.map.getPixelFromCoordinate(pointA)
                        let pixelPointB: Pixel = this.map.getPixelFromCoordinate(pointB)


                        let linestringFeature = new Feature(geometry)
                        linestringFeature.setGeometry(geometry)
                        let vertex = new LineString(getPartialRingCoordsFromLinstring(linestringFeature, pointA, pointB))
                        let vertexMiddle = new Point(vertex.getFlatMidpoint())

                        let pixelVertexMiddle: Pixel = this.map.getPixelFromCoordinate(vertexMiddle.getCoordinates())

                        return [
                            new Style({
                                image: new CircleStyle({
                                    radius: 6,
                                    stroke: new Stroke({ color: 'rgba(0,0,0,0.7)', width: 3 }),
                                    fill: new Fill({
                                        color: 'rgba(0,0,0,0)',
                                    }),
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelPointA) <= 5) {
                                        return new Point(pointA)
                                    } else if (getDistanceBetweenPixels(pixelFeatureO, pixelPointB) <= 5) {
                                        return new Point(pointB)
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                image: new RegularShape({
                                    fill: new Fill({ color: 'rgba(0,0,0,0.7)' }),
                                    stroke: new Stroke({ color: 'rgba(0,0,0,1)' }),
                                    points: 4,
                                    radius: 8,
                                    radius2: 0,
                                    angle: 0,
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) <= 5) {
                                        return vertexMiddle
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                image: new RegularShape({
                                    fill: new Fill({ color: 'rgba(255,0,0,0.7)' }),
                                    stroke: new Stroke({ color: 'rgba(255,0,0,1)' }),
                                    points: 4,
                                    radius: 5,
                                    radius2: 0,
                                    angle: 0,
                                }),
                                geometry: function (feature: Feature) {
                                    if (getDistanceBetweenPixels(pixelFeatureO, pixelVertexMiddle) > 5) {
                                        return vertexMiddle
                                    }
                                    return null
                                },
                            }),
                            new Style({
                                stroke: new Stroke({ color: 'rgba(255,0,0,0.3)', width: 8 }),
                                geometry: function (feature: Feature) {
                                    return vertex;
                                },
                            })
                        ]

                    } else if (geometryOnModify instanceof MultiPoint || geometryOnModify instanceof Point) {
                        return new Style({
                            image: new CircleStyle({
                                radius: 6,
                                stroke: new Stroke({ color: 'rgba(0,0,0,0.7)', width: 3 }),
                                fill: new Fill({
                                    color: 'rgba(0,0,0,0)',
                                }),
                            }),
                            geometry: function (feature: Feature) {
                                return geometryOnModify
                            },
                        })
                    }
                    return null
                } catch (error) {
                    // console.error(error)
                    return null
                }

            }
        })

        this.snapInteraction = new Snap({
            pixelTolerance: 12,
            edge: false,
            features: new Collection()
        })

        this.snapInteractionWithEdge = new Snap({
            pixelTolerance: 12,
            features: new Collection()
        })
    }

    /**
  * enable operation
  */
    public enable() {
        this.destroyed$ = new ReplaySubject(1)

        this.map.addInteraction(this.selectInteraction)
        this.map.addInteraction(this.modifyInteraction)

        this.addInteractionSnap_()

        fromOpenlayerEvent<MapBrowserEvent<PointerEvent>>(this.map, 'pointermove').pipe(
            tap((e) => {
                let features = this.map.getFeaturesAtPixel(
                    e.pixel,
                    {
                        layerFilter: (layer) => {
                            if (layer instanceof VectorLayer && layer.get('layerToDigitaliseID') != undefined && this.editableLayers.find((editableLayer) => editableLayer.get('layerToDigitaliseID') == layer.get('layerToDigitaliseID'))) {
                                return true
                            }
                            return false
                        }
                    }
                );

                let target = this.map.getTarget();
                let jtarget: HTMLElement
                if (typeof target === 'string') {
                    jtarget = document.getElementById(target)
                } else {
                    jtarget = target
                }
                if (features.length > 1 && this.snapInteraction.snapTo(e.pixel, e.coordinate, e.map)) {
                    jtarget.style.cursor = "crosshair"
                } else {
                    jtarget.style.cursor = ""
                }

            }),
            takeUntil(this.destroyed$),
        ).subscribe()


        fromOpenlayerEvent<SelectEvent>(this.selectInteraction, 'select').pipe(
            takeUntil(this.destroyed$),
            tap((selectEvent) => {
                this.updateLayer.getSource().clear()
                let geometrys = this.selectInteraction.getFeatures().getArray()
                /**
                 * Si on a 2 polygones, et que l'un a une partie dans l'autre : celui qui est contenu dans l'autre doit être en tête (zIndex) afin de pouvoir être modifié
                 */
                try {

                    if (this.selectInteraction.getFeatures().getArray().length == 2) {
                        let a: any = this.selectInteraction.getFeatures().getArray().slice()

                        let contains = booleanContainsPolygon(this.selectInteraction.getFeatures().getArray()[0].getGeometry() as Polygon, this.selectInteraction.getFeatures().getArray()[1].getGeometry() as Polygon)

                        if (contains) {
                            let diff = differenceBetweenGeometry(a[1].getGeometry() as Polygon, a[0].getGeometry() as Polygon)
                            if (diff && diff.getArea() != a[1].getGeometry().getArea()) {
                                geometrys.reverse()
                            }
                        }
                    }
                } catch (error) {
                    console.error(error)
                }
                this.updateLayer.getSource().addFeatures(geometrys)
            })
        ).subscribe()

        fromEvent<KeyboardEvent>(document, 'keydown').pipe(
            filter(() => this.modifyInteraction.getActive()),
            filter((event) => event.key == 'Backspace' || event.key == 'Delete'),
            tap((event: KeyboardEvent) => {
                this.modifyInteraction.removePoint()
            }),
            takeUntil(this.destroyed$),
        ).subscribe()

        fromOpenlayerEvent<ModifyEvent>(this.modifyInteraction, 'modifystart').pipe(
            takeUntil(this.destroyed$),
            tap((modfyEvent) => {
                this.isModifying_ = true
                this.featuresInEdition_ = modfyEvent.features.getArray().map((feature) => {
                    return {
                        id: feature.getId(),
                        properties: feature.getProperties()
                    }
                })

            })
        ).subscribe()

        fromOpenlayerEvent<ModifyEvent>(this.modifyInteraction, 'modifyend').pipe(
            takeUntil(this.destroyed$),
            filter((modfyEvent) => modfyEvent.features != undefined),
            tap((modfyEvent) => {
                let canModify = true
                this.isModifying_ = false

                let polygonFeatures_: any = modfyEvent.features.getArray().filter((feature) => feature.getGeometry() instanceof Polygon || feature.getGeometry() instanceof MultiPolygon)
                let polygonFeatures: Feature<Polygon | MultiPolygon>[] = polygonFeatures_

                let linstringFeatures_: any = modfyEvent.features.getArray().filter((feature) => feature.getGeometry() instanceof LineString || feature.getGeometry() instanceof MultiLineString)
                let linstringFeatures: Feature<Polygon | MultiPolygon>[] = linstringFeatures_

                function onlyUnique(value, index, self) {
                    return self.indexOf(value) === index;
                }

                polygonFeatures
                    .map((feature) => getLayerFromFeature(this.map, feature))
                    .filter((layer) => layer != undefined && layer.get('layerToDigitaliseID') != undefined)
                    .map((layer) => parseInt(layer.get('layerToDigitaliseID')))
                    .filter(onlyUnique)
                    .map((layerToDigitaliseID) => {
                        let layerToDigitalise = this.layersToDigitalise.find((layerToDigitalise) => layerToDigitalise.layer_id == layerToDigitaliseID)
                        let features_to_control = layerToDigitalise.layer.getSource().getFeatures().slice()
                        .filter((feature) => {
                            let FMAPfeatures: Array<FeatureStatus> = layerToDigitalise.layer.getSource().get('FMAPfeatures')
                            return FMAPfeatures.find((ff) => ff.id === feature.getId() && !ff.deleted)
                        })
                        /*if (booleanAllFeaturesIntersection(features_to_control)) {
                            polygonFeatures
                                .map((feature) => { return { layer: getLayerFromFeature(this.map, feature), feature: feature } })
                                .filter((parameters) => parameters.layer != undefined && parameters.layer.get('layerToDigitaliseID') != undefined)
                                .filter((parameters) => parseInt(parameters.layer.get('layerToDigitaliseID')) === layerToDigitaliseID)
                                .map((parameters) => {
                                    let feature_ = this.featuresInEdition_.find((feat) => feat.id == parameters.feature.getId())
                                    parameters.feature.setGeometry(feature_.properties.geometry)
                                    this.featuresInEdition_ = this.featuresInEdition_.slice().filter((feat) => feat.id != parameters.feature.getId())
                                })
                            canModify = false
                            this.notifier.notify("error", this.tranlate.instant('map.edit.overlapping_features_error'))
                        };*/

                    })


                polygonFeatures.concat(linstringFeatures).map((feature) => {
                    if (!booleanIsvalid(feature.getGeometry())) {
                        let feature_ = this.featuresInEdition_.find((feat) => feat.id == feature.getId())
                        feature.setGeometry(feature_.properties.geometry)
                        canModify = false
                        this.notifier.notify("error", this.tranlate.instant('map.edit.topological_error'))
                    }
                })

                if (canModify) {
                    modfyEvent.features.getArray().map((feature) => {
                        let feat = feature as Feature
                        updateGeometryFeature(getLayerFromFeature(this.map, feat), feat)
                    })
                }

            })
        ).subscribe()

        this.isEnable = true

        let defaultConfig: NotifierConfig = JSON.parse(JSON.stringify(this.notifier.getConfig()))
        this.notifier.getConfig().position.vertical.position = 'top'
        this.notifier.getConfig().position.vertical.distance = 40
        this.notifier.getConfig().position.horizontal.distance = 150
        this.notifier.getConfig().behaviour.showDismissButton = false
        this.notifier.hide("UpdateGeometry_NOTIFICATION_ID")
        this.notifier.show({
            id: 'UpdateGeometry_NOTIFICATION_ID',
            template: this.customNotificationTmpl,
            message: this.tranlate.instant('map.edit.edit_geometry_msg'),
            type: 'default'
        })
        window.setTimeout(() => {
            this.notifier.hide("UpdateGeometry_NOTIFICATION_ID")
        }, 10000)
        window.setTimeout(() => {
            this.notifier.getConfig().position.vertical.position = defaultConfig.position.vertical.position
            this.notifier.getConfig().position.vertical.distance = defaultConfig.position.vertical.distance
            this.notifier.getConfig().position.horizontal.distance
            this.notifier.getConfig().behaviour.showDismissButton = defaultConfig.behaviour.showDismissButton
        }, 1000)
    }


    /**
     * disable operation
     */
    public disable() {
        this.notifier.hide("UpdateGeometry_NOTIFICATION_ID")

        this.map.removeInteraction(this.selectInteraction)
        this.map.removeInteraction(this.modifyInteraction)
        this.map.removeInteraction(this.snapInteraction)
        this.map.removeInteraction(this.snapInteractionWithEdge)

        this.snapInteraction.dispose()
        this.snapInteractionWithEdge.dispose()
        this.selectInteraction.getFeatures().clear()
        this.updateLayer.getSource().clear()


        this.destroyed$.next(true)
        this.destroyed$.complete()

        this.isEnable = false

        let target = this.map.getTarget();
        let jtarget: HTMLElement
        if (typeof target === 'string') {
            jtarget = document.getElementById(target)
        } else {
            jtarget = target
        }
        jtarget.style.cursor = ""
    }

    private addInteractionSnap_() {
        this.snapInteraction.dispose()
        this.snapInteractionWithEdge.dispose()
        this.editableLayers.map((layer) => {
            layer.getSource().getFeatures().slice()
                .filter((feature) => {
                    let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
                    return FMAPfeatures.find((ff) => ff.id === feature.getId() && !ff.deleted)
                })
                .map((feature) => {
                    this.snapInteraction.addFeature(feature)
                    this.snapInteractionWithEdge.addFeature(feature)
                })
        })
        this.map.addInteraction(this.snapInteraction)
        this.map.addInteraction(this.snapInteractionWithEdge)
    }

}

export function fromOpenlayerEvent<T>(element: any, eventName: string): Observable<T> {

    return new Observable((observer: Subscriber<T>) => {
        const handler = (e: T) => observer.next(e);

        let eventKey = element.on(eventName, handler)

        return () => {
            unByKey(eventKey)
        }
    });
}