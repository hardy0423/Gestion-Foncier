import { ComponentFactoryResolver, ComponentRef, ViewContainerRef } from "@angular/core";
import OverlayPositioning from "ol/OverlayPositioning";
import { fromEvent } from "rxjs";
import { debounceTime, delay, tap, map as mapRxjs, filter } from "rxjs/operators";
import { FeaturePopupComponent } from "src/app/attribute-form/pages/feature-popup/feature-popup.component";
import { Geometry, Map, Overlay, VectorLayer, VectorSource } from "src/app/ol-module";

export class FeaturePopup{
    
    overlay:Overlay

    constructor(
        public map:Map,
        public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
        public popupTemplate:ViewContainerRef,
        private resolver: ComponentFactoryResolver
    ){

        let featurePopupComponent = this.createComponent_()
        this.popupTemplate.element.nativeElement.style.display = 'none'
        this.overlay= new Overlay({
            offset:[15,0],
            element: this.popupTemplate.element.nativeElement,
            positioning:OverlayPositioning.TOP_LEFT
        });
        this.map.addOverlay(this.overlay)
        
        fromEvent<MouseEvent>(this.map.getViewport(), 'mousemove').pipe(
            delay(500), 
            filter(()=>{
                if (this.popupTemplate.element.nativeElement.style.display != 'block') {
                    return true
                }
                return Array.from(document.querySelectorAll( ":hover" )).find((element)=>element.id==='popupTemplateId') == undefined
            }), 
            tap(()=>this.popupTemplate.element.nativeElement.style.display = 'none'),
            // delay(500),
            debounceTime(500),
            filter((event)=>{
                let pixel = this.map.getEventPixel(event);
                return this.map.getFeaturesAtPixel(pixel,{
                    layerFilter: (layer) => {
                        if (layer instanceof VectorLayer && layer.get('layerToDigitaliseID') != undefined && this.editableLayers.find((editableLayer) => editableLayer.get('layerToDigitaliseID') == layer.get('layerToDigitaliseID'))) {
                            return true
                        }
                    },
                    hitTolerance:10
                }).length == 1
            }),
            mapRxjs((event)=>{
                let pixel = this.map.getEventPixel(event);
                return this.map.forEachFeatureAtPixel(
                    pixel,
                    (feature, layer) => {
                        return {feature:feature,layer:layer, coordinate:this.map.getCoordinateFromPixel(pixel)};
                    },
                    {
                        layerFilter: (layer) => {
                            if (layer instanceof VectorLayer && layer.get('layerToDigitaliseID') != undefined && this.editableLayers.find((editableLayer) => editableLayer.get('layerToDigitaliseID') == layer.get('layerToDigitaliseID'))) {
                                return true
                            }
                        },
                        hitTolerance:10
                    }
                );
            }),
            filter((parameter)=> parameter && parameter.feature != undefined && parameter.layer != undefined),
            tap((parameter)=>{
                featurePopupComponent.instance.feature = parameter.feature
                this.popupTemplate.element.nativeElement.style.display= 'block'
                featurePopupComponent.instance.onInitInstance()
                this.overlay.setPosition(parameter.coordinate)
            })
        ).subscribe()
    }
    
    /**
     * Créer une div qui recevra le popup, inserer ce popup dans la div de la map
     * NB: si il existe d'autre div popup avec pour class "featurePopup", ils seront enlevé
     */
    private createComponent_():ComponentRef<FeaturePopupComponent>{
        this.popupTemplate.clear()
        const factory = this.resolver.resolveComponentFactory(FeaturePopupComponent);
        let comp =   this.popupTemplate.createComponent(factory);
        this.popupTemplate.element.nativeElement.id="popupTemplateId"
        this.popupTemplate.element.nativeElement.appendChild(comp.location.nativeElement)
        return comp
       
    }
}