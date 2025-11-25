import { TemplateRef, ViewContainerRef } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Map } from "ol";
import { singleClick } from "ol/events/condition";
import { Select } from "ol/interaction";
import { SelectEvent } from "ol/interaction/Select";
import { Fill, Stroke, Style } from "ol/style";
import { fromEvent, Observable, ReplaySubject, Subscriber } from "rxjs";
import { filter, takeUntil, tap } from "rxjs/operators";
import { LoadComponentService } from "src/app/data/services/load-component.service";
import { getLayerFromFeature, mergePolygons } from "src/app/data/utils/geo";
import {
  CircleStyle,
  Feature,
  Geometry,
  Polygon,
  unByKey,
  VectorLayer,
  VectorSource,
} from "src/app/ol-module";
import { LayerToDigitalise } from "../../../data/models/layer-to-digitalise";
import { deleteFeature, updateGeometryFeature } from "./featureCrud";

export class MergeFeature {
  selectInteraction: Select;
  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  isEnable: boolean = false;

  constructor(
    public map: Map,
    public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
    public layersToDigitalise: Array<LayerToDigitalise>,
    public viewContainerRef: ViewContainerRef,
    public loadComponentService: LoadComponentService,
    public notifier: NotifierService,
    public customNotificationTmpl: TemplateRef<HTMLElement>,
    public translate: TranslateService
  ) {
    this.isEnable = false;
  }

  /**
   * enable operation
   */
  enable() {
    let defaultConfig: NotifierConfig = JSON.parse(
      JSON.stringify(this.notifier.getConfig())
    );
    this.notifier.getConfig().position.vertical.position = "top";
    this.notifier.getConfig().position.vertical.distance = 40;
    this.notifier.getConfig().position.horizontal.distance = 150;
    this.notifier.getConfig().behaviour.showDismissButton = false;
    this.notifier.hide("MergeFeature_NOTIFICATION_ID");
    this.notifier.show({
      id: "MergeFeature_NOTIFICATION_ID",
      template: this.customNotificationTmpl,
      message: this.translate.instant("map.edit.merge_msg"),
      type: "default",
    });
    window.setTimeout(() => {
      this.notifier.hide("MergeFeature_NOTIFICATION_ID");
    }, 10000);
    window.setTimeout(() => {
      this.notifier.getConfig().position.vertical.position =
        defaultConfig.position.vertical.position;
      this.notifier.getConfig().position.vertical.distance =
        defaultConfig.position.vertical.distance;
      this.notifier.getConfig().position.horizontal.distance;
      this.notifier.getConfig().behaviour.showDismissButton =
        defaultConfig.behaviour.showDismissButton;
    }, 1000);

    this.destroyed$ = new ReplaySubject(1);
    // let featuresCanBeSelected:Array<Feature<Polygon>> = [].concat.apply([], this.editableLayers.map((layer)=>layer.getSource().getFeatures().filter((feature)=>feature.getGeometry().getType() =='Polygon')))
    this.selectInteraction = new Select({
      multi: true,
      layers: this.editableLayers,
      filter: function (feature: Feature, layer) {
        return (
          feature.getGeometry().getType() === "Polygon" ||
          feature.getGeometry().getType() === "MultiPolygon"
        );
      },
      style: (feature: Feature): Style => {
        var type = feature.getGeometry().getType();
        var style: Style;
        if (type == "Point" || type == "MultiPoint") {
          style = new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({
                color: [255, 235, 59, 1],
              }),
              stroke: new Stroke({ color: "rgba(0,0,0,1)", width: 3 }),
            }),
            zIndex: 100000,
          });
        } else if (type == "LineString" || type == "MultiLineString") {
          style = new Style({
            stroke: new Stroke({
              color: "rgba(255,235,59,1)",
              width: 8,
            }),
            zIndex: 100000,
          });
        } else if (type == "Polygon" || type == "MultiPolygon") {
          style = new Style({
            fill: new Fill({
              color: "rgba(255,235,59,1)",
            }),
            stroke: new Stroke({
              color: "rgba(0,0,0,1)",
              width: 2,
            }),
            zIndex: 100000,
          });
        }
        return style;
      },
      toggleCondition: (e) => {
        return singleClick(e);
      },
    });

    this.map.addInteraction(this.selectInteraction);

    fromEvent(this.map.getViewport(), "mousemove")
      .pipe(
        tap((event: MouseEvent) => {
          let pixel = this.map.getEventPixel(event);
          let hit = this.map.forEachFeatureAtPixel(
            pixel,
            (feature, layer) => {
              return true;
            },
            {
              layerFilter: (layer) => {
                if (
                  layer instanceof VectorLayer &&
                  layer.get("layerToDigitaliseID") != undefined &&
                  this.editableLayers.find(
                    (editableLayer) =>
                      editableLayer.get("layerToDigitaliseID") ==
                      layer.get("layerToDigitaliseID")
                  )
                ) {
                  return true;
                }
                return false;
              },
            }
          );

          let target = this.map.getTarget();
          let jtarget: HTMLElement;
          if (typeof target === "string") {
            jtarget = document.getElementById(target);
          } else {
            jtarget = target;
          }

          if (hit) {
            jtarget.style.cursor = "pointer";
          } else {
            jtarget.style.cursor = "";
          }
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    fromOpenlayerEvent<SelectEvent>(this.selectInteraction, "select")
      .pipe(
        takeUntil(this.destroyed$),
        tap((selectEvent) => {
          console.log(
            selectEvent.selected.length,
            this.selectInteraction.getFeatures().getLength()
          );
        }),
        filter(
          (selectEvent) => this.selectInteraction.getFeatures().getLength() == 2
        ),
        tap((selectEvent) => {
          let featuresSelected: any = this.selectInteraction
            .getFeatures()
            .getArray();
          let polygon1: Feature<Polygon> = featuresSelected[0];
          let polygon2: Feature<Polygon> = featuresSelected[1];

          if (this.isFeatureSameTypoCodId_(polygon1, polygon2)) {
            let mergedPolygon = mergePolygons(
              polygon1.getGeometry(),
              polygon2.getGeometry()
            );

            if (mergedPolygon instanceof Polygon) {
              polygon1.setGeometry(mergedPolygon);
              updateGeometryFeature(
                getLayerFromFeature(this.map, polygon1),
                polygon1
              );

              let layer = this.selectInteraction.getLayer(polygon2);

              deleteFeature(layer, polygon2);
            } else {
              this.notifier.notify(
                "error",
                this.translate.instant(
                  "map.edit.geometries_dont_share_same_vertex"
                )
              );
            }
          } else {
            this.notifier.notify(
              "error",
              this.translate.instant(
                "map.edit.geometries_dont_have_same_properties"
              )
            );
          }

          window.setTimeout(() => {
            this.selectInteraction.getFeatures().clear();
          }, 500);
        })
      )
      .subscribe();

    this.isEnable = true;
  }

  /**
   * disable operation
   */
  disable() {
    this.notifier.hide("MergeFeature_NOTIFICATION_ID");

    this.map.removeInteraction(this.selectInteraction);
    this.selectInteraction.getFeatures().clear();

    this.destroyed$.next(true);
    this.destroyed$.complete();
    this.viewContainerRef.clear();

    this.isEnable = false;

    let target = this.map.getTarget();
    let jtarget: HTMLElement;
    if (typeof target === "string") {
      jtarget = document.getElementById(target);
    } else {
      jtarget = target;
    }
    jtarget.style.cursor = "";
  }

  private isFeatureSameTypoCodId_(
    feature1: Feature,
    feature2: Feature
  ): boolean {
    if (
      feature1.get("typo_codes_id") == undefined &&
      feature2.get("typo_codes_id") == undefined
    ) {
      return (
        feature1.get("alias") == feature2.get("alias") &&
        feature1.get("sites_id") == feature1.get("sites_id")
      );
    }
    return (
      feature1.get("typo_codes_id") != undefined &&
      feature2.get("typo_codes_id") != undefined &&
      feature1.get("typo_codes_id") == feature2.get("typo_codes_id") &&
      feature1.get("modes").length == feature2.get("modes").length &&
      feature1
        .get("modes")
        .every(
          (value, index) =>
            value.mode_codes_id ===
              feature2.get("modes")[index].mode_codes_id &&
            value.frequence === feature2.get("modes")[index].frequence
        )
    );
  }
}

export function fromOpenlayerEvent<T>(
  element: any,
  eventName: string
): Observable<T> {
  return new Observable((observer: Subscriber<T>) => {
    const handler = (e: T) => observer.next(e);

    let eventKey = element.on(eventName, handler);

    return () => {
      unByKey(eventKey);
    };
  });
}
