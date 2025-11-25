import { ComponentRef, TemplateRef, ViewContainerRef } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Map } from "ol";
import { Select } from "ol/interaction";
import { SelectEvent } from "ol/interaction/Select";
import { Fill, Stroke, Style } from "ol/style";
import { EMPTY, from, fromEvent, Observable, of, ReplaySubject, Subject, Subscriber } from "rxjs";
import { map, switchMap, take, takeUntil, tap } from "rxjs/operators";
import { getLayerFromFeature } from "src/app/data/utils/geo";
// import { TeridealFeature } from "src/app/models/teridealFeature";
import { CircleStyle, Feature, Geometry, unByKey, VectorLayer, VectorSource } from "src/app/ol-module";
import { ConfirmationDialogComponent } from "src/app/shared/pages/confirmation-dialog/confirmation-dialog.component";
import { LayerToDigitalise } from "../../../data/models/layer-to-digitalise";
import { AttributeForm, LoadComponentService } from "src/app/data/services/load-component.service";
import { FeatureProperties } from "src/app/data/models/type";
import { TranslateService } from "@ngx-translate/core";
import { Map as MapData} from "maplibre-gl";

export class UpdateAttributes {
    selectFeature: (feature: Feature) => void

    selectInteraction: Select
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    isEnable: boolean = false
    attributeFormComponent: ComponentRef<AttributeForm>

    constructor(
        public map: Map,
        public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
        public layersToDigitalise: Array<LayerToDigitalise>,
        public viewContainerRef: ViewContainerRef,
        public loadComponentService: LoadComponentService,
        public notifier:NotifierService,
        public dialog: MatDialog,
        public customNotificationTmpl:TemplateRef<HTMLElement>,
        public translate: TranslateService,
        public mapData: MapData
    ) {
        this.isEnable = false
        this.selectInteraction = new Select({
            multi: false,
            layers: this.editableLayers,
            style: (feature: Feature): Style => {
                var type = feature.getGeometry().getType()
                var style: Style;
                if (type == 'Point' || type == 'MultiPoint') {
                    style = new Style({
                        image: new CircleStyle({
                            radius: 7,
                            fill: new Fill({
                                color: [255, 235, 59, 1]
                            }),
                            stroke: new Stroke({ color: 'rgba(0,0,0,1)', width: 3 }),
                        }),
                        zIndex: 99
                    })
                } else if (type == 'LineString' || type == 'MultiLineString') {
                    style = new Style({
                        stroke: new Stroke({
                            color: 'rgba(255,235,59,1)',
                            width: 8
                        }),
                        zIndex: 99
                    })

                } else if (type == 'Polygon' || type == 'MultiPolygon') {
                    style = new Style({
                        fill: new Fill({
                            color: 'rgba(255,235,59,1)',
                        }),
                        stroke: new Stroke({
                            color: 'rgba(0,0,0,1)',
                            width: 2,
                            lineDash: [10,20,0,20]
                        }),
                        zIndex: 99
                    })
                }
                return style
            }
        });

        this.selectFeature = (feature) => {
            this.selectInteraction.getFeatures().push(feature);
            this.selectInteraction.dispatchEvent(
                new SelectEvent(
                    'select',
                    [feature],
                    [],
                    undefined
                )
            );
         }
    }

    /**
     * enable operation
     */
    enable() {
        this.destroyed$ = new ReplaySubject(1)

        this.map.addInteraction(this.selectInteraction)


        fromEvent<MouseEvent>(this.map.getViewport(), 'mousemove').pipe(
            tap((event: MouseEvent) => {
                let pixel = this.map.getEventPixel(event);
                let hit = this.map.forEachFeatureAtPixel(
                    pixel,
                    (feature, layer) => {
                        return true;
                    },
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

                if (hit) {
                    jtarget.style.cursor = "pointer"
                } else {
                    jtarget.style.cursor = ""
                }

            }),
            takeUntil(this.destroyed$),
        ).subscribe()

        fromOpenlayerEvent<SelectEvent>(this.selectInteraction, 'select').pipe(
            takeUntil(this.destroyed$),
            map(selectEvent => 
                selectEvent.selected
                    .map((feature) => {
                        let layer = getLayerFromFeature(this.map, feature)
                        let layerToDigitalise = this.layersToDigitalise.find((layerToDigitalise) => layerToDigitalise.layer_id == layer.get('layerToDigitaliseID'))
                        if (layerToDigitalise) {
                            return {
                                layerToDigitalise: layerToDigitalise,
                                feature: feature,
                                map: this.map,
                                selectInteraction : this.selectInteraction,
                                mapData: this.mapData
                            }
                        }
                        return null  
                    })
                    .filter((item) => item)
            ),
            switchMap((parameters) => {
                return of(parameters)
            }),
            // filter(parameters => !!parameters),
            tap((parameters) => {
                if (parameters.length == 1) {
                    from(this.loadComponentService.loadComponent(this.viewContainerRef)).pipe(
                        take(1),
                        switchMap((component) => {
                            this.attributeFormComponent = component
                            component.instance.feature = parameters[0].feature
                            component.instance.layerToDigitalise = parameters[0].layerToDigitalise
                            component.instance.map = parameters[0].map
                            component.instance.mapData = parameters[0].mapData
                            component.instance.close = new Subject<boolean>()
                            return component.instance.close.pipe(map((response) => { return { response: response, component: component } }))
                        }),
                        map((response) => {
                            response.component.destroy()
                            this.attributeFormComponent = undefined
                            this.selectInteraction.getFeatures().clear()
                            setTimeout(()=> {
                                this.map.updateSize()
                            }, 500)
                            setTimeout(()=> {
                                this.map.updateSize()
                            }, 1000)
                        })
                    ).subscribe()

                } else if (parameters.length == 0) {
                    this.attributeFormComponent = undefined
                    this.viewContainerRef.clear()
                    if(!this.attributeFormComponent && this.viewContainerRef.length == 0) {
                        setTimeout(()=> {
                            this.map.updateSize()
                        }, 500)
                    }
                }
            })
        ).subscribe()

        this.isEnable = true

        let defaultConfig:NotifierConfig = JSON.parse(JSON.stringify(this.notifier.getConfig()))
        this.notifier.getConfig().position.vertical.position = 'top'
        this.notifier.getConfig().position.vertical.distance = 40
        this.notifier.getConfig().position.horizontal.distance = 150
        this.notifier.getConfig().behaviour.showDismissButton = false
        this.notifier.hide("UpdateAttributes_NOTIFICATION_ID")
        this.notifier.show({
            id:'UpdateAttributes_NOTIFICATION_ID',
            template:this.customNotificationTmpl,
            message:this.translate.instant('map.edit.edit_feature_msg'),
            type:'default'
        })
        window.setTimeout(()=>{
            this.notifier.hide("UpdateAttributes_NOTIFICATION_ID")
        }, 7000)
        window.setTimeout(()=>{
            this.notifier.getConfig().position.vertical.position = defaultConfig.position.vertical.position
            this.notifier.getConfig().position.vertical.distance = defaultConfig.position.vertical.distance
            this.notifier.getConfig().position.horizontal.distance
            this.notifier.getConfig().behaviour.showDismissButton = defaultConfig.behaviour.showDismissButton
        }, 1000)
    }

    /**
     * disable operation
     */
    disable() {
        this.notifier.hide("UpdateAttributes_NOTIFICATION_ID")
        this.map.removeInteraction(this.selectInteraction)
        this.selectInteraction.getFeatures().clear()

        this.destroyed$.next(true)
        this.destroyed$.complete()
        this.viewContainerRef.clear()

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