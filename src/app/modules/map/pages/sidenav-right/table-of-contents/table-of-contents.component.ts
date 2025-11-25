import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import {
  Component,
  Input,
  OnInit,
  SimpleChanges,
  LOCALE_ID,
  Inject,
} from "@angular/core";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  ReplaySubject,
  Subscription,
  merge,
  merge as observerMerge,
} from "rxjs";

import { Clipboard } from "@angular/cdk/clipboard";
import { MatCheckboxChange } from "@angular/material/checkbox";
import {
  DialogPosition,
  MatDialog,
  MatDialogConfig,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatDrawerContainer } from "@angular/material/sidenav";
import { MatSliderChange } from "@angular/material/slider";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslateService } from "@ngx-translate/core";
import { LngLat, Map, MapStyleDataEvent } from "maplibre-gl";
import {
  catchError,
  delay,
  filter,
  startWith,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import {
  CategoryStyle,
  LayerProviders,
  Metadata,
} from "src/app/data/models/type";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import {
  DataToShareLayer,
  ShareServiceService,
} from "src/app/data/services/share-service.service";
import {
  CartoHelper,
  CatalogueLayer,
  layersInMap,
} from "src/app/data/utils/cartoHelper";
import { MapLibreEvent } from "src/app/data/utils/maplibreEvent";
import { environment } from "src/environments/environment";
import { AttributesTableComponent } from "../../attributes-table/attributes-table.component";
import { MetadataComponentComponent } from "../../metadata-dialog/metadata-component/metadata-component.component";
import { MapsService } from "src/app/data/services/maps.service";
import { HttpErrorResponse } from "@angular/common/http";
import { NotifierService } from "angular-notifier";
import { DatePipe } from "@angular/common";
import {
  SymbologyColorComponent,
  SymbologyData
} from "../../symbology-color/symbology-color.component";
import { StoreService } from "src/app/data/store/store.service";
import { LayersRight, User } from "src/app/data/models/account";
import { RightService } from "src/app/data/services/right.service";
import { FullscreenService } from "src/app/data/services/fullscreen.service";

@Component({
  selector: "app-table-of-contents",
  templateUrl: "./table-of-contents.component.html",
  styleUrls: ["./table-of-contents.component.scss"],
})
/**
 * Composnent of table of contents for handle layers
 */
export class TableOfContentsComponent implements OnInit {
  @Input() map: Map;
  @Input() sidenavContainer: MatDrawerContainer;

  attributeDialog: MatDialogRef<AttributesTableComponent, any>;

  layersInToc: Array<layersInMap> = [];
  private destroyed$: ReplaySubject<void> = new ReplaySubject(1);

  /**
   * Window position status
   */
  windowPosition: BehaviorSubject<"maximize" | "minimize"> =
    new BehaviorSubject("maximize");

  optionsSelected$: BehaviorSubject<[Array<CategoryStyle>, number]> =
    new BehaviorSubject([[], null]);

  /**
   * Listen to options selected
   */

  setOptionsSelected(params: [Array<CategoryStyle>, number]) {
    this.optionsSelected$.next(params);
  }

  layersCategoryToogle: [];
  result: Metadata;
  color: string;
  loading: boolean;
  symbologyData: SymbologyData;
  dialogRef: MatDialogRef<SymbologyColorComponent>;
  toggle: boolean = false;
  default_color: string = "#2889e9";
  user: User;
  layerRight: LayersRight;

  isFullscreen = false;
  private fullscreenSubscription: Subscription;
  
  constructor(
    public dialog: MatDialog,
    public geoData: GeoDataService,
    public shareServie: ShareServiceService,
    private _snackBar: MatSnackBar,
    private clipboard: Clipboard,
    public translate: TranslateService,
    public mapsService: MapsService,
    public notifier: NotifierService,
    public datepipe: DatePipe,
    @Inject(LOCALE_ID) private locale: string,
    private datePipe: DatePipe,
    public store: StoreService,
    public rightService: RightService,
    private fullscreenService: FullscreenService
    ) {
    CartoHelper;
    this.user = this.store.user;

    if(this.user?.group_id){
      this.rightService.getLayersByGroup(this.user?.group_id).pipe(
        take(1),
        catchError(() => {
          this.notifier.notify(
            "error",
            this.translate.instant("user.error_loading_right")
          );
          return EMPTY;
        })
      ).subscribe((res) => {
        this.layerRight = res;
      });
    }
  }

  ngOnInit(): void {
    this.fullscreenSubscription = this.fullscreenService.fullscreen$.subscribe(isFullscreen => {
      this.isFullscreen = isFullscreen;
      if (this.isFullscreen) {
        this.destroyAllModalOfTableOfContents();
      }
    });
  }

  ngOnDestroy() {
    if (this.fullscreenSubscription) {
      this.fullscreenSubscription.unsubscribe();
    }
    this.destroyAllModalOfTableOfContents();
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["map"].currentValue) {
      if (this.map) {
        let mapLibreEvent = new MapLibreEvent();
        mapLibreEvent
          .fromMapLibreEvent(this.map, "idle")
          .pipe(
            delay(1),
            tap(() => {
              this.getAllLayersForTOC();
            }),
            takeUntil(this.destroyed$)
          )
          .subscribe();

        this.optionsSelected$
          .pipe(
            filter(() => this.optionsSelected$.value[1] != null),
            tap((e) => {
              let cartoHelper = new CartoHelper(this.map);
              let couche = cartoHelper.getLayerByPropertiesCatalogue({
                couche_id: this.optionsSelected$.value[1],
                type: "couche",
              })[0].metadata as CatalogueLayer;

              couche.categoryStyles.list = this.optionsSelected$.value[0];
              cartoHelper.addOrReloadWms(couche);
            }),
            takeUntil(this.destroyed$)
          )
          .subscribe();
      }
    }

    if (
      changes["sidenavContainer"] &&
      changes["sidenavContainer"].currentValue
    ) {
      setTimeout(() => {
        if (this.sidenavContainer.start && this.sidenavContainer.end) {
          merge(
            this.sidenavContainer.start.openedChange,
            this.sidenavContainer.end.openedChange,
            this.windowPosition
          )
            .pipe(
              filter(() => this.attributeDialog != undefined),
              filter(() => this.attributeDialog.getState() === 0),
              tap(() => {
                this.updateDialogPosition();
              }),
              takeUntil(this.destroyed$)
            )
            .subscribe();
        }
      }, 1000);
    }
  }

  setPanelStatus(layer_id: number, status: boolean) {
    let cartoHelper = new CartoHelper(this.map);
    let couches = cartoHelper.getLayerByPropertiesCatalogue({
      couche_id: layer_id,
      type: "couche",
    });
    if (couches.length > 0) {
      let couche = couches[0].metadata as CatalogueLayer;
      couche.categoryStyles.toogled = status;
    }
  }

  getPanelStatus(layer_id: number): boolean {
    let cartoHelper = new CartoHelper(this.map);
    let couches = cartoHelper.getLayerByPropertiesCatalogue({
      couche_id: layer_id,
      type: "couche",
    });
    if (couches.length == 0) {
      return false;
    }

    let couche = couches[0].metadata as CatalogueLayer;
    return couche.categoryStyles.toogled;
  }

  getSelectedCategoryLength(layer_id: number) {
    let cartoHelper = new CartoHelper(this.map);
    let couches = cartoHelper.getLayerByPropertiesCatalogue({
      couche_id: layer_id,
      type: "couche",
    });
    if (couches.length == 0) {
      return 0;
    }

    let couche = couches[0].metadata as CatalogueLayer;
    return couche.categoryStyles.list.length;
  }

  /**
   * Construct the array this.layersInToc array.
   */
  getAllLayersForTOC() {
    let allObservableOFLayers: Array<Observable<MapStyleDataEvent & Object>> =
      [];

    this.layersInToc = new CartoHelper(this.map)
      .getAllLayersInToc()
      .filter((layerProp) => layerProp.type_layer == "geosmCatalogue")
      .filter((layerProp, index, self) => {
        /**
         * unique layer ^^
         */
        return (
          self
            .map((item) => item.properties.couche_id + item.properties["type"])
            .indexOf(
              layerProp.properties.couche_id + layerProp.properties["type"]
            ) === index
        );
      })
      .map((layerProp) => {
        if (layerProp.properties["type"] == "couche") {
          let groupLayer = this.geoData.getLayerInMap(
            layerProp.properties.couche_id
          );

          layerProp.properties.group_id;
          layerProp.badge = {
            text: groupLayer.group.name,
            bgColor: groupLayer.group.color,
          };
          layerProp.data = groupLayer;
        }
        let mapLibreEvent = new MapLibreEvent();
        layerProp.layer.map((ll) => {
          allObservableOFLayers.push(
            mapLibreEvent.fromMapLibreEvent(this.map, "styledata", ll.id)
          );
        });
        layerProp.visible;
        layerProp.isToggle;
        
        return layerProp;
      });

    function compare(a, b) {
      if (a.zIndex < b.zIndex) {
        return 1;
      }
      if (a.zIndex > b.zIndex) {
        return -1;
      }
      return 0;
    }

    if (allObservableOFLayers.length > 0) {
      observerMerge(...allObservableOFLayers)
        .pipe(
          startWith(undefined),
          tap(() => {
            this.layersInToc.sort(compare);
          }),
          takeUntil(this.destroyed$)
        )
        .subscribe();
    }
  }

  /**
   *drag and drop of layer finish
   @param event CdkDragDrop<string[]>
   */
  drop(event: CdkDragDrop<string[]>) {
    let cartoHelperClass = new CartoHelper(this.map);
    var layer = this.layersInToc[event.previousIndex];
    /**
     * -1 => -2
     * 1 => 2
     * 2=>2
     * -2 =>-2
     */
    if (event.previousIndex - event.currentIndex != 0) {
      layer.layer.map((ll) =>
        cartoHelperClass.editZindexOfLayer(
          ll,
          event.previousIndex,
          event.currentIndex
        )
      );

      moveItemInArray(
        this.layersInToc,
        event.previousIndex,
        event.currentIndex
      );
      this.getAllLayersForTOC();
    }
  }

  /**
   * Set opacity of a layer
   * @param event MatSliderChange
   * @param layer layersInMap
   */
  setOpactiyOfLayer(event: MatSliderChange, layer: layersInMap) {
    layer.layer
      .filter((lay) => lay.type == "raster")
      .map((lay) =>
        this.map.setPaintProperty(lay.id, "raster-opacity", event.value / 100)
      );
  }

  getOpacityOfLayer(layer_id: string) {
    try {
      return (
        parseFloat(
          this.map.getPaintProperty(layer_id, "raster-opacity") != undefined
            ? (this.map.getPaintProperty(layer_id, "raster-opacity") as string)
            : "1"
        ) * 100
      );
    } catch (error) {
      return 100;
    }
  }

  /**
   * Set color of a layer
   * @param event ColorPickerClose
   * @param layer layersInMap
   */
  setColorOfLayer(color: string, layer: layersInMap) {
    this.loading = true;
    layer.layer
      .filter((lay) => lay.type == "raster")
      .map((lay) => {
        let metadata = layer.layer[0].metadata as CatalogueLayer;
        let data = {
          project: metadata.qgis_project,
          layer_name: metadata.identifiant[0],
          color: color,
          group_id: this.store.user?.group_id,
          layer_id: metadata?.properties.couche_id
        };

        return this.mapsService
          .updateLayerColor(data)
          .pipe(
            catchError((error: HttpErrorResponse) => {
              this.notifier.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant(error.error.msg)
              );
              this.loading = false;
              return EMPTY;
            }),
            tap((res) => {
              let cartoHelper = new CartoHelper(this.map);
              cartoHelper.addOrReloadWms(metadata);
            })
          )
          .subscribe((res) => {
            this.loading = false;
            this.notifier.notify("success", this.translate.instant(res.msg));
          });
      });
  }

  public onEventLog(color: any, layer: layersInMap): void {
    return this.setColorOfLayer(color, layer);
  }

  /**
   * Toogle visible of a layer
   * @param event MatCheckboxChange
   * @param layer layersInMap
   */
  setVisibleOfLayer(event: MatCheckboxChange, layer: layersInMap) {
    layer.layer.map((lay) => {
      this.map
        .getLayer(lay.id)
        .setLayoutProperty("visibility", event.checked ? "visible" : "none");
    });
    this.map._update();
  }

  /**
   * Remove layer of type cataogue from map
   * @param layer layersInMap
   */
  removeLayer(layer: layersInMap) {
    if (layer["properties"]["type"] == "carte") {
      // this.dataOsmLayersServiceService.removeBaseMap(layer['properties']['couche_id'], this.map)
    } else if (layer["properties"]["type"] == "couche") {
      this.geoData.removeLayer(layer["properties"]["couche_id"], this.map);
    } else {
      layer.layer.map((lay) => new CartoHelper(this.map).removeLayerToMap(lay));
    }
  }

  /**
   * remove all layer of type layersInMap in map
   */
  clearMap() {
    new CartoHelper(this.map)
      .getAllLayersInToc()
      .filter((layerProp) => layerProp.tocCapabilities.removable)
      .map((layerProp) => {
        this.removeLayer(layerProp);
      });
  }

  /**
   * Share a layer
   * @param layer
   */
  shareLayer(layer: layersInMap) {
    if (layer.properties.type == "couche") {
      let groupLayer = this.geoData.getLayerInMap(layer.properties.couche_id);
      var params = this.shareServie.shareLayer({
        id_layer: layer.properties.couche_id,
        group_id: groupLayer.group.group_id,
        type: "layer",
      });
      var url_share = environment.frontendUrl + "/map?" + params;
      // this._snackBar.openFromComponent(SocialShareComponent, {
      //   duration: 7 * 1000,
      //   data: { url: url_share }
      // });

      this._snackBar
        .open(this.truncateUrl(url_share), this.translate.instant("copy"), {
          duration: 7 * 1000,
          panelClass: ["primary-snackbar"],
        })
        .onAction()
        .pipe(
          tap(() => {
            this.clipboard.copy(url_share);
            this._snackBar.open(
              this.translate.instant("share.link_copied"),
              this.translate.instant("close"),
              {
                duration: 5 * 1000,
                panelClass: ["primary-snackbar"],
              }
            );
          }),
          takeUntil(this.destroyed$)
        )
        .subscribe();
    } else {
      var params = this.shareServie.shareLayer({
        id_layer: layer.properties.couche_id,
        group_id: null,
        type: "map",
      });
      var url_share = environment.frontendUrl + "/map?" + params;
      this._snackBar
        .open(this.truncateUrl(url_share), this.translate.instant("copy"), {
          duration: 7 * 1000,
          panelClass: ["primary-snackbar"],
        })
        .onAction()
        .pipe(
          tap(() => {
            this.clipboard.copy(url_share);
            this._snackBar.open(
              this.translate.instant("share.link_copied"),
              this.translate.instant("close"),
              {
                duration: 5 * 1000,
                panelClass: ["primary-snackbar"],
              }
            );
          }),
          takeUntil(this.destroyed$)
        )
        .subscribe();
    }
  }

  truncateUrl(url: string): string {
    return url.slice(0, 35).toString() + "...";
  }
  /**
   * Share all layers in the toc
   */
  shareAllLayersInToc() {
    let pteLayerToGetParams: Array<DataToShareLayer> = this.layersInToc
      .filter((item) => item.tocCapabilities.share)
      .map((item) => {
        if (item.properties["type"] == "couche") {
          let groupLayer = this.geoData.getLayerInMap(
            item.properties.couche_id
          );
          return {
            id_layer: item.properties.couche_id,
            group_id: groupLayer.group.group_id,
            type: "layer",
          };
        } else if (item.properties["type"] == "carte") {
          return {
            id_layer: item.properties.couche_id,
            group_id: null,
            type: "map",
          };
        } else {
          return null;
        }
      });

    //Retrieve center's coordinates
    var { lng, lat }: LngLat = this.map.getCenter();
    // var lonlat = Transform(center, 'EPSG:3857', 'EPSG:4326');
    // var lon = center[0];
    // var lat = center[1];
    var zoom = this.map.getZoom();

    var coordinateSharedLink =
      "pos=" + lng.toFixed(4) + "," + lat.toFixed(4) + "," + Math.floor(zoom);

    var params = this.shareServie.shareLayers(pteLayerToGetParams);

    var url_share =
      environment.frontendUrl + "/map?" + params + "&" + coordinateSharedLink;

    this._snackBar
      .open(this.truncateUrl(url_share), this.translate.instant("copy"), {
        duration: 7 * 1000,
        panelClass: ["primary-snackbar"],
      })
      .onAction()
      .pipe(
        tap(() => {
          this.clipboard.copy(url_share);
          this._snackBar.open(
            this.translate.instant("share.link_copied"),
            this.translate.instant("close"),
            {
              duration: 5 * 1000,
              panelClass: ["primary-snackbar"],
            }
          );
        }),
        takeUntil(this.destroyed$)
      )
      .subscribe();
  }

  /**
   * Should we display the button tht open metadata modal ?
   * @param metadata Object
   */
  displayMetadataLink(metadata) {
    if (Array.isArray(metadata)) {
      return false;
    } else {
      return true;
    }
  }

  destroyAllModalOfTableOfContents() {
    for (let index = 0; index < this.dialog.openDialogs.length; index++) {
      const elementDialog = this.dialog.openDialogs[index];

      if (
        elementDialog.componentInstance instanceof AttributesTableComponent &&
        document.getElementById(elementDialog.id) &&
        document.getElementById(elementDialog.id).parentElement
      ) {
        elementDialog.close();
      }
    }
  }

  /**
   * open attributes table
   * @param layer layersInMap
   */
  openAttributesTable(layer: layersInMap) {
    let data = this.geoData.getLayerInMap(layer.properties.couche_id);
    let position = {
      bottom: "-30px",
      left: this.sidenavContainer.start._getWidth() + 130 + "px",
      right: this.sidenavContainer.end._getWidth() + "px",
    };
    for (let index = 0; index < this.dialog.openDialogs.length; index++) {
      const elementDialog = this.dialog.openDialogs[index];

      if (
        elementDialog.componentInstance instanceof AttributesTableComponent &&
        document.getElementById(elementDialog.id) &&
        document.getElementById(elementDialog.id).parentElement
      ) {
        elementDialog.close();
      }
    }

    this.attributeDialog = this.dialog.open(AttributesTableComponent, {
      data: [data.layer, this.map, this.windowPosition],
      panelClass: [
        "modalWithoutRaduis",
        "modalWithoutBoxShadow",
        "dialogWithNoPadding",
        "dialogWithNoContentPadding",
        "animate__animated",
        "animate__slideInBottom",
        "attribute-table-dialog",
      ],
      width:
        window.innerWidth -
        this.sidenavContainer.start._getWidth() -
        130 -
        this.sidenavContainer.end._getWidth() +
        "px",
      maxWidth: "100vw",
      position: position,
      hasBackdrop: false,
    });

    this.windowPosition.next("maximize");
  }

  /**
   * update dialog position
   */
  updateDialogPosition() {
    let position: DialogPosition = {
      left: this.sidenavContainer.start._getWidth() + 130 + "px",
      right: this.sidenavContainer.end._getWidth() + "px",
    };
    if (this.windowPosition.value == "minimize") {
      position.top = "calc(100vh - 45px)";
    } else {
      position.bottom = "0";
    }

    this.attributeDialog.updateSize(
      window.innerWidth -
        this.sidenavContainer.start._getWidth() -
        130 -
        this.sidenavContainer.end._getWidth() +
        "px"
    );
    this.attributeDialog.updatePosition(position);
  }

  /**
   * open attributes table
   * @param layer layersInMap
   */
  openLayerMetaData(layer: layersInMap) {
    this.mapsService
      .getLayerMetadata(layer.properties.couche_id)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (
            error.error.status_code == 404 &&
            error.error.detail == "Not found."
          ) {
            this.notifier.notify(
              "default",
              this.translate.instant("couche_en_cours.no_metadata")
            );
          } else {
            this.notifier.notify(
              "error",
              this.translate.instant("couche_en_cours.error_loading_metadata")
            );
          }
          return EMPTY;
        })
      )
      .subscribe((val) => {
        this.result = val;
        this.result.date_meta = this.result.date_meta ? this.newDate(this.result.date_meta) : null;
        if (!this.result.admin_meta && !this.result.source && !this.result.link_meta && !this.result.description && !this.result.date_meta) {
          this.notifier.notify(
            "default",
            this.translate.instant("couche_en_cours.no_metadata")
          );
        } else {
          let proprietes: MatDialogConfig = {
            disableClose: false,
            minWidth: "35vw",
            maxHeight: "45vw",
            width: "35vw",
            hasBackdrop: false,
            autoFocus: false,
          };
          proprietes.data = this.result ? this.result : {};
          const dialogRef = this.dialog.open(
            MetadataComponentComponent,
            proprietes
          );
        }
      });
  }

  newDate(date: string): string {
    let date_to_format = new Date(date);
    let latest_date = this.datepipe.transform(
      date_to_format,
      "dd MMMM yyyy",
      this.locale
    );
    return latest_date;
  }

  /**
  ** open color picker dialog for symbology categorized
  */
  openDialogCategorySymbology(layerProviders: LayerProviders, layer: layersInMap): void {
    let categoryNotNullValue : CategoryStyle[] = layerProviders.vs.category.filter(cat => cat.name !== null);
    categoryNotNullValue.map((cat) => {
      cat.isToggle = false;
      cat.isUpdate = false;
    });

    layerProviders.vs.category = categoryNotNullValue;
    this.symbologyData = {
      layer: layerProviders,
      layerInMap: layer,
      map: this.map,
    };
    
    let proprietes: MatDialogConfig = {
      minWidth: 500,
      width: "150px",
      data: this.symbologyData,
    };

    this.dialogRef = this.dialog.open(SymbologyColorComponent, proprietes);

    this.dialogRef.afterClosed().subscribe(result => {
      if(result instanceof Object){

        this.loading = true;
        let metadata = layer.layer.filter((lay) => lay.type == "raster")[0].metadata as CatalogueLayer;

        this.mapsService
          .updateLayerColor(result)
          .pipe(
            catchError((error: HttpErrorResponse) => {
              this.notifier.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant(error.error.msg)
              );
              this.loading = false;
              return EMPTY;
            }),
            tap((res) => {
              let cartoHelper = new CartoHelper(this.map);
              cartoHelper.addOrReloadWms(metadata);
              this.loading = false;
              this.notifier.notify("success", this.translate.instant(res.msg));
            })
          )
          .subscribe((res) => {
            
          });
      }
      if(result == "cancel"){
        catchError((error: HttpErrorResponse) => {
          this.notifier.notify(
            "error",
            error.error?.msg
              ? error.error.msg
              : this.translate.instant("layer.error_editing_layer_color")
          );
          this.loading = false;
          return EMPTY;
        })
      }
    });
  }

  /**
   * open color picker dialog for symbology categorized
   */
  toggleColorPicker(layer: layersInMap): void {
    layer.isToggle = !layer.isToggle;
  }

  /**
   * check if the user group can write on the current layer
   */
  userHasRight(layer_data: any): boolean{
    if(this.user.is_superuser){
      return true;
    }
    else if (this.user?.group_id) {
      if(this.layerRight.write.length == 0){
        return false;
      } 
      else{
        if (this.layerRight.write.filter((lay) => lay.layer_id == layer_data.layer.layer_id).length > 0) return true;
        return false;
      } 
    }
    return false;
  }
}
