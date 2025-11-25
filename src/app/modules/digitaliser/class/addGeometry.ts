import { TemplateRef, ViewContainerRef } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierConfig, NotifierService } from "angular-notifier";
import { Collection, Map, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { MultiPoint } from "ol/geom";
import Geometry, { Type } from "ol/geom/Geometry";
import { Draw, Snap } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Fill, Stroke, Style } from "ol/style";
import { from, fromEvent, Observable, ReplaySubject, Subject } from "rxjs";
import {
  filter,
  map as mapRxjs,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import { LoadComponentService } from "src/app/data/services/load-component.service";
import {
  booleanAllFeaturesIntersection,
  booleanIsvalid,
  getAllPointsOfLinestring,
  getAllPointsOfPolygon,
} from "src/app/data/utils/geo";
import { handleDataHelper } from "src/app/data/utils/handleData";
import {
  CircleStyle,
  Feature,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  VectorLayer,
  VectorSource,
} from "src/app/ol-module";
import {
  FeatureStatus,
  LayerToDigitalise,
} from "../../../data/models/layer-to-digitalise";
import {
  ChooseLayerToAddComponent,
  LayerToAddChoose,
} from "../modal/choose-layer-to-add/choose-layer-to-add.component";
import { addFeature } from "./featureCrud";
import { fromOpenlayerEvent } from "./updateAttributes";
import { Map as MapData} from "maplibre-gl";

export class AddGeometry {
  private chooseLayerToAdd_: () => Observable<LayerToAddChoose>;
  public onChangeLayerToAddInstance: () => void;

  drawInteraction: Draw;
  private snapInteraction: Snap;
  private snapInteractionWithEdge: Snap;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  isEnable: boolean = false;

  // layerToAdd: LayerToAddChoose

  constructor(
    public map: Map,
    public editableLayers: Array<VectorLayer<VectorSource<Geometry>>>,
    public layersToDigitalise: Array<LayerToDigitalise>,
    public viewContainerRef: ViewContainerRef,
    public loadComponentService: LoadComponentService,
    public notifier: NotifierService,
    public dialog: MatDialog,
    // public sites_id: number,
    public customNotificationTmpl: TemplateRef<HTMLElement>,
    public translate: TranslateService,
    public mapData: MapData
  ) {
    this.isEnable = false;

    this.onChangeLayerToAddInstance = () => {
      this.destroyed$.next(true);
      this.destroyed$.complete();
      this.destroyed$ = new ReplaySubject(1);

      let defaultConfig: NotifierConfig = JSON.parse(
        JSON.stringify(this.notifier.getConfig())
      );
      this.notifier.getConfig().position.vertical.position = "top";
      this.notifier.getConfig().position.vertical.distance = 40;
      this.notifier.getConfig().position.horizontal.distance = 150;
      this.notifier.getConfig().behaviour.showDismissButton = false;
      this.notifier.hide("AddGeometry_NOTIFICATION_ID");
      this.notifier.show({
        id: "AddGeometry_NOTIFICATION_ID",
        template: this.customNotificationTmpl,
        message:
          this.translate.instant('map.edit.add_geometry_msg'),
        type: "default",
      });
      window.setTimeout(() => {
        this.notifier.hide("AddGeometry_NOTIFICATION_ID");
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

    //   this.layerToAdd = layerToAddChoose;
      if (this.drawInteraction) {
        this.map.removeInteraction(this.drawInteraction);
        this.map.removeInteraction(this.snapInteraction);
        this.map.removeInteraction(this.snapInteractionWithEdge);
      }

      this.drawInteraction = new Draw({
        features: new Collection(),
        type: this.layersToDigitalise[0].typologie as Type,
        style: (feature: Feature) => {
          let geometryOnModify = feature.getGeometry();
          if (
            geometryOnModify instanceof MultiPolygon ||
            geometryOnModify instanceof Polygon
          ) {
            return [
              new Style({
                fill: new Fill({
                  color: "rgba(255,0,0,0.4)",
                }),
                stroke: new Stroke({ color: "rgba(0,0,0,0.4)" }),
                zIndex: 1000,
              }),
              new Style({
                image: new CircleStyle({
                  radius: 4,
                  stroke: new Stroke({ color: "rgba(255,0,0,0.4)", width: 6 }),
                  fill: new Fill({
                    color: "rgba(0,0,0,0.7)",
                  }),
                }),
                geometry: function (feature: Feature<Polygon>) {
                  let coordinates: Array<Coordinate> = getAllPointsOfPolygon(
                    feature.getGeometry()
                  );
                  return new MultiPoint(coordinates);
                },
                zIndex: 1000,
              }),
            ];
          } else if (
            geometryOnModify instanceof MultiLineString ||
            geometryOnModify instanceof LineString
          ) {
            return [
              new Style({
                stroke: new Stroke({
                  color: "rgba(255,0,0,0.4)",
                  width: 6,
                }),
                zIndex: 1000001,
              }),
              new Style({
                image: new CircleStyle({
                  radius: 4,
                  stroke: new Stroke({ color: "rgba(255,0,0,0.4)", width: 6 }),
                  fill: new Fill({
                    color: "rgba(0,0,0,0.7)",
                  }),
                }),
                geometry: function (
                  feature: Feature<LineString | MultiLineString>
                ) {
                  feature.getGeometry();
                  let coordinates: Array<Coordinate> = getAllPointsOfLinestring(
                    feature.getGeometry()
                  );
                  return new MultiPoint(coordinates);
                },
                zIndex: 1000001,
              }),
            ];
          } else if (
            geometryOnModify instanceof MultiPoint ||
            geometryOnModify instanceof Point
          ) {
            return new Style({
              image: new CircleStyle({
                radius: 4,
                stroke: new Stroke({ color: "rgba(255,0,0,0.4)", width: 6 }),
                fill: new Fill({
                  color: "rgba(0,0,0,0.7)",
                }),
              }),
              zIndex: 1000001,
            });
          }
          return null;
        },
      });

      fromOpenlayerEvent<DrawEvent>(this.drawInteraction, "drawend")
        .pipe(
          takeUntil(this.destroyed$),
          mapRxjs((event) => {
            let feature = event.feature;
            if (
              feature.getGeometry() instanceof Point == false &&
              feature.getGeometry() instanceof MultiPoint == false
            ) {
              let layerToDigitalise = this.layersToDigitalise.find(
                (layerToDigitalise) =>
                  layerToDigitalise.layer_id == this.layersToDigitalise[0].layer_id
              );
              let features_to_control = layerToDigitalise.layer
                .getSource()
                .getFeatures()
                .slice()
                .filter((feature) => {
                  let FMAPfeatures: Array<FeatureStatus> =
                    layerToDigitalise.layer.getSource().get("FMAPfeatures");
                  return FMAPfeatures.find(
                    (ff) => ff.id === feature.getId() && !ff.deleted
                  );
                });
              features_to_control.push(feature);

              /*if (
                (feature.getGeometry() instanceof Polygon ||
                  feature.getGeometry() instanceof MultiPolygon) &&
                booleanAllFeaturesIntersection(features_to_control)
              ) {
                this.notifier.notify(
                  "error",
                  this.translate.instant('map.edit.overlapping_features_error')
                );
                this.drawInteraction.abortDrawing();
                return undefined;
              } else */
              if (!booleanIsvalid(feature.getGeometry())) {
                this.notifier.notify("error", this.translate.instant('map.edit.topological_error'));
                this.drawInteraction.abortDrawing();
                return undefined;
              } else {
                return event;
              }
            }
            return event;
          }),
          filter((event) => event != undefined),
          tap((event) => {
            let newFeature = event.feature;
            // newFeature.set("alias", layerToAddChoose.alias);
            let id = handleDataHelper.makeid();
            let layerToDigitalise = this.layersToDigitalise[0]
            while (
              layerToDigitalise.layer
                .getSource()
                .getFeatures()
                .map((feat) => feat.getId())
                .indexOf(id) != -1
            ) {
              let id = handleDataHelper.makeid();
            }

            newFeature.setId(id);
            // newFeature.set('sites_id',this.sites_id)

            layerToDigitalise.layer.getSource().addFeature(newFeature);
            this.map.removeInteraction(this.snapInteraction);
            this.map.removeInteraction(this.snapInteractionWithEdge);
            addFeature(layerToDigitalise.layer, newFeature);

            this.addInteractionSnap_();
            from(this.loadComponentService.loadComponent(this.viewContainerRef))
              .pipe(
                take(1),
                switchMap((component) => {
                  component.instance.feature = newFeature;
                  component.instance.layerToDigitalise = layerToDigitalise;
                  component.instance.map = this.map;
                  component.instance.mapData = this.mapData;

                  component.instance.close = new Subject<boolean>();
                  return component.instance.close.pipe(
                    mapRxjs((response) => {
                      return { response: response, component: component };
                    })
                  );
                }),
                mapRxjs((response) => {
                  response.component.destroy();
                  setTimeout(() => {
                    this.map.updateSize();
                  }, 500);
                  setTimeout(() => {
                    this.map.updateSize();
                  }, 1000);
                })
              )
              .subscribe();
          })
        )
        .subscribe();

      this.map.addInteraction(this.drawInteraction);
      this.addInteractionSnap_();
    };

    this.chooseLayerToAdd_ = () => {
      let layersToAddChoose: LayerToAddChoose[] = this.layersToDigitalise
        .map((layerToDigitalise) => {
          let geometryType: string = layerToDigitalise.typologie;
          // if (layerToDigitalise.typologie == 'linestring') {
          //     geometryType = 'LineString'
          // } else if (layerToDigitalise.typologie == 'point') {
          //     geometryType = 'Point'
          // } else if (layerToDigitalise.typologie == 'polygon') {
          //     geometryType = 'Polygon'
          // }

          return layerToDigitalise.legend.value.map((legend) => {
            let layerToAddChoose: LayerToAddChoose = Object.assign(
              {
                geometryType: geometryType,
                layer_id: layerToDigitalise.layer_id,
              },
              legend
            );

            return layerToAddChoose;
          });
        })
        .reduce((acc, val) => acc.concat(val), []);

      return this.dialog
        .open<ChooseLayerToAddComponent, LayerToAddChoose[], LayerToAddChoose>(
          ChooseLayerToAddComponent,
          {
            data: layersToAddChoose,
            panelClass: "panelWithNoPadding",
            disableClose: false,
          }
        )
        .afterClosed();
    };

    let featuresSnap = [];
    this.editableLayers.map((layer) => {
      layer
        .getSource()
        .getFeatures()
        .map((feature) => {
          featuresSnap.push(feature);
        });
    });

    this.snapInteraction = new Snap({
      pixelTolerance: 12,
      edge: false,
      features: new Collection(),
    });

    this.snapInteractionWithEdge = new Snap({
      pixelTolerance: 12,
      features: new Collection(),
    });
  }

  /**
   * enable operation
   */
  public enable() {
    this.notifier.hide("AddGeometry_NOTIFICATION_ID");
    this.isEnable = true;
    this.destroyed$ = new ReplaySubject(1);
    this.onChangeLayerToAddInstance();

    fromOpenlayerEvent<MapBrowserEvent<PointerEvent>>(this.map, "pointermove")
      .pipe(
        tap((e) => {
          let target = this.map.getTarget();
          let jtarget: HTMLElement;
          if (typeof target === "string") {
            jtarget = document.getElementById(target);
          } else {
            jtarget = target;
          }

          if (this.snapInteraction.snapTo(e.pixel, e.coordinate, e.map)) {
            jtarget.style.cursor = "crosshair";
          } else {
            jtarget.style.cursor = "";
          }
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();

    fromEvent<KeyboardEvent>(window, "keydown")
      .pipe(
        takeUntil(this.destroyed$),
        filter((event) => ["Backspace", "Escape"].includes(event.key)),
        filter(() => this.drawInteraction != undefined),
        tap((event) => {
          if (event.key == "Backspace") {
            this.drawInteraction.removeLastPoint();
          } else if (event.key == "Escape") {
            this.drawInteraction.abortDrawing();
          }
        })
      )
      .subscribe();
  }

  /**
   * disable operation
   */
  public disable() {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.map.removeInteraction(this.snapInteraction);
      this.map.removeInteraction(this.snapInteractionWithEdge);
    }
    // this.layerToAdd = undefined;
    this.viewContainerRef.clear();

    this.destroyed$.next(true);
    this.destroyed$.complete();

    this.isEnable = false;
  }

  private addInteractionSnap_() {
    this.snapInteraction.dispose();
    this.snapInteractionWithEdge.dispose();
    this.editableLayers.map((layer) => {
      layer
        .getSource()
        .getFeatures()
        .slice()
        .filter((feature) => {
          let FMAPfeatures: Array<FeatureStatus> = layer
            .getSource()
            .get("FMAPfeatures");
          return FMAPfeatures.find(
            (ff) => ff.id === feature.getId() && !ff.deleted
          );
        })
        .map((feature) => {
          this.snapInteraction.addFeature(feature);
          this.snapInteractionWithEdge.addFeature(feature);
        });
    });
    this.map.addInteraction(this.snapInteraction);
    this.map.addInteraction(this.snapInteractionWithEdge);
  }
}
