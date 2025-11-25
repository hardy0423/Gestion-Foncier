import { TemplateRef, ViewContainerRef } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Collection, Map } from "ol";
import { Coordinate } from "ol/coordinate";
import { MultiPoint } from "ol/geom";
import { Draw, Snap } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Fill, Stroke, Style } from "ol/style";
import { EMPTY, fromEvent, ReplaySubject } from "rxjs";
import { catchError, filter, map as mapRxjs, takeUntil, tap } from "rxjs/operators";
import { LoadComponentService } from "src/app/data/services/load-component.service";
import { booleanContains, booleanIsvalid, getAllPointsOfLinestring, getLayerFromFeature, splitGeometrys } from "src/app/data/utils/geo";
import { handleDataHelper } from "src/app/data/utils/handleData";
import { CircleStyle, Feature, Geometry, LineString, MultiLineString, MultiPolygon, Point, Polygon, VectorLayer, VectorSource } from "src/app/ol-module";
import { FeatureStatus, LayerToDigitalise } from "../../../data/models/layer-to-digitalise";
import { addFeature, updateGeometryFeature } from "./featureCrud";
import { fromOpenlayerEvent } from "./updateAttributes";

export class SplitGeometry {

    drawInteraction: Draw
    private snapInteraction: Snap

    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    isEnable: boolean = false

    constructor(
        public map: Map,
        public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
        public layersToDigitalise: Array<LayerToDigitalise>,
        public viewContainerRef: ViewContainerRef,
        public loadComponentService: LoadComponentService,
        public notifier: NotifierService,
        public dialog: MatDialog,
        // public sites_id: number,
        public customNotificationTmpl: TemplateRef<HTMLElement>
    ) {
        this.isEnable = false

        this.snapInteraction = new Snap({
            pixelTolerance: 12,
            vertex: false,
            features: new Collection([])
        })

        this.drawInteraction = new Draw({
            features: new Collection(),
            type: 'LineString',
            style: (feature: Feature) => {
                let geometryOnModify = feature.getGeometry()
                if (geometryOnModify instanceof MultiPoint || geometryOnModify instanceof Point) {
                    return new Style({
                        image: new CircleStyle({
                            radius: 4,
                            stroke: new Stroke({ color: 'rgba(255,0,0,0.4)', width: 6 }),
                            fill: new Fill({
                                color: 'rgba(0,0,0,0.7)',
                            }),
                        }),
                        zIndex: 1000001
                    })

                } else if (geometryOnModify instanceof MultiLineString || geometryOnModify instanceof LineString) {
                    return [
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

                }
                return null
            }
        })


    }

    /**
* enable operation
*/
    public enable() {
        this.destroyed$ = new ReplaySubject(1)

        this.map.addInteraction(this.drawInteraction)
        this.loadFeatureInSnap_()
        this.map.addInteraction(this.snapInteraction)

        fromOpenlayerEvent<DrawEvent>(this.drawInteraction, 'drawend').pipe(
            takeUntil(this.destroyed$),
            mapRxjs((event) => {
                let feature = event.feature
                if (feature.getGeometry()) {
                    if (!booleanIsvalid(feature.getGeometry())) {
                        this.notifier.notify("error", " Problème topologique")
                        this.drawInteraction.abortDrawing()
                        return undefined
                    } else {
                        return feature
                    }
                }
                return null
            }),
            filter((feature) => feature != undefined),
            mapRxjs((feature) => {
                let geometry: any = feature.getGeometry()
                // if (geometry.getType() == 'Polygon') {
                let i = 0;
                let features_to_control = this.editableLayers.map((layer) => {
                    return layer.getSource().getFeatures().slice()
                        .filter((featue) => featue.getGeometry().getType() == 'Polygon' || 'MultiPolygon')
                        .filter((feature) => {
                            let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
                            return FMAPfeatures.find((ff) => ff.id === feature.getId() && !ff.deleted)
                        })
                })
                let allFeatures: Array<Feature<Polygon | MultiPolygon>> = [].concat.apply([], features_to_control)

                let featuresThatContainsGeometry: Array<Feature<Polygon | MultiPolygon | LineString | MultiLineString>> = []

                while (i < allFeatures.length) {

                    if (booleanContains(allFeatures[i].getGeometry(), geometry)) {
                        featuresThatContainsGeometry.push(allFeatures[i])
                        if (featuresThatContainsGeometry.length > 1) {
                            this.notifier.notify("error", " Votre ligne ne doit pas supperposer plusieurs géométries")
                            break
                        }
                    }
                    i++
                }
                if (featuresThatContainsGeometry.length == 0) {
                    this.notifier.notify("error", " Votre ligne doit être contenue dans une autre géométrie")
                } else if (featuresThatContainsGeometry.length == 1) {

                    let newGeometrys = splitGeometrys<Polygon | MultiPolygon | LineString | MultiLineString>(featuresThatContainsGeometry[0].getGeometry(), geometry)
                    if (newGeometrys) {
                        let layerToDigitalise = getLayerFromFeature(this.map, featuresThatContainsGeometry[0])
                        newGeometrys.slice(1).map((newGeometry) => {
                            let newFeature = featuresThatContainsGeometry[0].clone()
                            let id = handleDataHelper.makeid()
                            while (layerToDigitalise.getSource().getFeatures().map((feat) => feat.getId()).indexOf(id) != -1) {
                                let id = handleDataHelper.makeid()
                            }

                            newFeature.setId(id)
                            // newFeature.set('sites_id', this.sites_id)

                            newFeature.setGeometry(newGeometry)
                            layerToDigitalise.getSource().addFeature(newFeature)

                            addFeature(layerToDigitalise, newFeature)
                        })
                        featuresThatContainsGeometry[0].setGeometry(newGeometrys[0])
                        updateGeometryFeature(getLayerFromFeature(this.map, featuresThatContainsGeometry[0]), featuresThatContainsGeometry[0])

                    } else {
                        this.notifier.notify("error", " Nous n'avons pas pu séparer les éléments ")
                    }

                }
                // }
                return undefined
            }),
            filter((value) => !!value),

            catchError(() => {
                this.notifier.notify('error', ' Nous avons rencontré une érreur')
                return EMPTY
            })
        ).subscribe()

        fromEvent<KeyboardEvent>(window, 'keydown').pipe(
            takeUntil(this.destroyed$),
            filter((event) => ['Backspace', 'Escape'].includes(event.key)),
            filter(() => this.drawInteraction != undefined),
            tap((event) => {
                if (event.key == 'Backspace') {
                    this.drawInteraction.removeLastPoint()
                } else if (event.key == 'Escape') {
                    this.drawInteraction.abortDrawing()
                }
            })
        ).subscribe()

        this.isEnable = true

        let defaultConfig: NotifierConfig = JSON.parse(JSON.stringify(this.notifier.getConfig()))
        this.notifier.getConfig().position.vertical.position = 'top'
        this.notifier.getConfig().position.vertical.distance = 40
        this.notifier.getConfig().position.horizontal.distance = 150
        this.notifier.getConfig().behaviour.showDismissButton = false
        this.notifier.hide("SplitGeometry_NOTIFICATION_ID")
        this.notifier.show({
            id: 'SplitGeometry_NOTIFICATION_ID',
            template: this.customNotificationTmpl,
            message: "<div> Dessiner une ligne pour diviser une surface en plusieurs parties</div>",
            type: 'default'
        })
        window.setTimeout(() => {
            this.notifier.hide("SplitGeometry_NOTIFICATION_ID")
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
        this.notifier.hide("SplitGeometry_NOTIFICATION_ID")
        this.map.removeInteraction(this.drawInteraction)
        this.map.removeInteraction(this.snapInteraction)

        this.snapInteraction.dispose()


        this.destroyed$.next(true)
        this.destroyed$.complete()

        this.isEnable = false
    }

    private loadFeatureInSnap_() {
        this.snapInteraction.dispose()
        this.editableLayers.map((layer) => {
            layer.getSource().getFeatures().slice()
                .filter((feature) => {
                    let FMAPfeatures: Array<FeatureStatus> = layer.getSource().get('FMAPfeatures')
                    return FMAPfeatures.find((ff) => ff.id === feature.getId() && !ff.deleted)
                })
                .map((feature) => {
                    this.snapInteraction.addFeature(feature)
                })
        })
    }

}