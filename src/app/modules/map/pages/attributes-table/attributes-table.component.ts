import { SelectionModel } from "@angular/cdk/collections";
import { HttpErrorResponse } from "@angular/common/http";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnInit,
  Renderer2,
  ViewChild,
} from "@angular/core";
import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSort, Sort } from "@angular/material/sort";
import { TranslateService } from "@ngx-translate/core";
import { bbox } from "@turf/turf";
import { NotifierService } from "angular-notifier";
import { Feature, Geometry } from "geojson";
import { LngLatBoundsLike, Map } from "maplibre-gl";
import { GeoJSONFeatureCollection } from "ol/format/GeoJSON";
import {
  BehaviorSubject,
  EMPTY,
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
} from "rxjs";
import {
  catchError,
  debounceTime,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs/operators";
import { ResultOfDigitalise } from "src/app/data/models/layer-to-digitalise";
import {
  CustomField,
  GeometryTypeProvider,
  Layer,
  VectorProvider,
} from "src/app/data/models/type";
import { FieldService } from "src/app/data/services/field.service";
import { MapsService } from "src/app/data/services/maps.service";
import { StoreService } from "src/app/data/store/store.service";
import { CartoHelper, CatalogueLayer } from "src/app/data/utils/cartoHelper";
import { Feature as OlFeature, WFS } from "src/app/ol-module";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { UpdateJoinTableComponent } from "./update-join-table/update-join-table.component";
import { UpdateMultipleComponent } from "./update-multiple/update-multiple.component";

export interface AttributeTableInfo {
  displayedColumns: string[];
  searchColumns: Array<{ field: string; fieldtype: "text" | "number" | "int" | "date" }>;
  provider: VectorProvider;
  customField: CustomField[];
  featureCount: number;
  getSearchColumns: () => Array<string>;
}

export interface Cell {
  id: string;
  column: string;
  value?: any;
}

@Component({
  selector: "app-attributes-table",
  templateUrl: "./attributes-table.component.html",
  styleUrls: ["./attributes-table.component.scss"],
})
export class AttributesTableComponent implements OnInit {
  onInitInstance: () => void;

  /**
   * Emit to sort column
   */
  onSortChangeInstance: (e: Sort) => void;

  /**
   * Emit to change page
   */
  onPageChangeInstance: (e: PageEvent) => void;

  /**
   * Emit to zoom in seleted features
   */
  onZoomInstance: () => void;

  /**
   * Emit to download
   */
  onDownloadInstance: (format: string) => void;

  /**
   * Select all features
   */
  onSelectAllFeaturesInstance: (checkboxStatus: boolean) => void;

  /**
   * Emit to valid
   */
  onValidInstance: (cell: Cell) => void;

  /**
   * Emit to delete the selection
   */
  onDeleteSelectionInstance: () => void;

  /**
   * Emit to update the selection
   */
  onUpdateSelectionInstance: () => void;

  /**
   * Emit to update the data
   */
  onUpdateDataInstance: () => void;

  /**
   * Selection model for features
   */
  selection = new SelectionModel<string>(true, []);

  /**
   * Window position status
   */
  windowPosition: BehaviorSubject<"maximize" | "minimize">;

  filterDataStatus: boolean = false;

  private readonly notifier: NotifierService;

  form: FormGroup = this.formBuilder.group({});
  formTable: FormGroup = this.formBuilder.group({});

  data$: Observable<Feature[]>;

  resultsLength = 0;

  isLoadingResults: boolean = false;
  isLoadingDownload: boolean = false;
  isRateLimitReached = false;
  editable: boolean = false;

  cell: Cell = {
    id: "",
    column: "",
  };

  loadingTable$: Observable<AttributeTableInfo>;

  selectedFeatures$: Observable<GeoJSONFeatureCollection>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) set paginator_(paginator: MatPaginator) {
    if (paginator) {
      paginator.page
        .pipe(
          takeUntil(this.destroyed$),
          tap((e: PageEvent) => {
            this.onPageChangeInstance(e);
          })
        )
        .subscribe();
    }
  }
  @ViewChild(MatSort) set sort_(sort: MatSort) {
    if (sort) {
      sort.sortChange
        .pipe(
          takeUntil(this.destroyed$),
          tap((e: Sort) => {
            this.onSortChangeInstance(e);
          })
        )
        .subscribe();
    }
  }

  private startY: number;
  private startHeight: number;
  private startTop: number;
  private resizing = false;
  viewportHeight = window.innerHeight;
  tableHeight = 0.5 * this.viewportHeight - 45;
  tableHeightCss = `${this.tableHeight}px`;

  constructor(
    public fieldService: FieldService,
    public manageCompHelper: ManageCompHelper,
    public dialogRef: MatDialogRef<AttributesTableComponent>,
    private cdRef: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    public notifierService: NotifierService,
    public mapsService: MapsService,
    public dialog: MatDialog,
    public translate: TranslateService,
    public store: StoreService,
    @Inject(MAT_DIALOG_DATA)
    public inputData: [
      layer: Layer,
      map: Map,
      comp: BehaviorSubject<"maximize" | "minimize">
    ],
    private el: ElementRef, 
    private renderer: Renderer2
  ) {
    this.notifier = notifierService;
    this.windowPosition = this.inputData[2];

    this.formTable = this.formBuilder.group({
      rows: this.formBuilder.array([]),
    });

    const onInit: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onSelectAllFeatures: Subject<boolean> = new Subject<boolean>();
    this.onSelectAllFeaturesInstance = (checkboxStatus: boolean) => {
      onSelectAllFeatures.next(checkboxStatus);
    };

    const onValid: Subject<Cell> = new Subject<Cell>();
    this.onValidInstance = (cell: Cell) => {
      onValid.next(cell);
    };

    const onDeleteSelection: Subject<void> = new Subject<void>();
    this.onDeleteSelectionInstance = () => {
      onDeleteSelection.next();
    };

    const onUpdateSelection: Subject<void> = new Subject<void>();
    this.onUpdateSelectionInstance = () => {
      onUpdateSelection.next();
    };

    const onUpdateData: Subject<void> = new Subject<void>();
    this.onUpdateDataInstance = () => {
      onUpdateData.next();
    };

    onSelectAllFeatures
      .pipe(
        takeUntil(this.destroyed$),
        map((checkboxStatus) => {
          if (checkboxStatus) {
            this.paginator["_pageSize"] = -1;
            this.onInitInstance();
            return true;
          } else {
            this.selection.clear();
            return false;
          }
        }),
        switchMap((res) => {
          if (this.data$ && res) {
            return this.data$.pipe(
              filter((data) => data.length > 0),
              tap((data: any) => {
                this.selection.clear();
                data.map((feat) => {
                  let id: string = feat.id;
                  this.selection.toggle(id);
                });
              })
            );
          }
          return of([]);
        })
      )
      .subscribe();

    this.loadingTable$ = merge(onInit, this.form.valueChanges).pipe(
      tap(() => {
        if (this.constructWFSFilter().length == 0) {
          /**
           * Si on a aucun filtre, on vide la selection. et on remet la pagination
           */
          if (this.paginator && this.paginator.pageSize === -1) {
            this.paginator["_pageSize"] = this.paginator.pageSizeOptions[0];
            this.onSelectAllFeaturesInstance(false);
            this.onInitInstance();
          }
        }
      }),
      switchMap(() => {
        this.isLoadingResults = true;
        this.cdRef.detectChanges();
        let layer = inputData[0];
        let provider = layer.providers[0];

        let querryFeatureCount =
          "map=" +
          provider.vp.path_qgis +
          "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&RESULTTYPE=hits&OUTPUTFORMAT=application/json&TYPENAME=" +
          provider.vp.id_server +
          "&EXP_FILTER=" +
          encodeURIComponent(this.constructWFSFilter());
        return this.fieldService.getFeaturesCount(querryFeatureCount).pipe(
          catchError((error: HttpErrorResponse) => {
            this.notifier.notify(
              "error",
              error.error?.msg
                ? error.error.msg
                : this.translate.instant(
                    "map.attribute_tables.error_getting_count_features"
                  )
            );
            this.isLoadingResults = false;
            return EMPTY;
          }),
          withLatestFrom(
            this.loadingTable$ == undefined
              ? of(undefined)
              : this.loadingTable$.pipe(startWith(undefined))
          ),
          switchMap((parameters) => {
            let featCount = parameters[0];
            /**
             * Si loadingTable$ existe déja, on met juste à jour le nombre d'netités. On ne formate plus le formulaire this.form
             */
            if (parameters[1] != undefined) {
              parameters[1].featureCount = featCount.numberOfFeatures;
              return of(parameters[1]);
            }
            let query =
              "MAP=" +
              provider.vp.path_qgis +
              "&SERVICE=WFS&VERSION=1.1.0&REQUEST=DescribeFeatureType&TYPENAME=" +
              provider.vp.id_server;

            return this.fieldService
              .getCustomFieldsOfVectorProvider(query)
              .pipe(
                catchError((error) => {
                  this.notifier.notify(
                    "error",
                    error.error?.msg
                      ? error.error.msg
                      : this.translate.instant(
                          "map.attribute_tables.error_getting_count_fields"
                        )
                  );
                  this.isLoadingResults = false;
                  return EMPTY;
                }),
                map((fields) => {
                  let result: AttributeTableInfo = {
                    displayedColumns: fields.map((f) =>
                      f.alias_fr ? f.alias_fr : f.name_field
                    ),
                    searchColumns: fields.map((f) => {
                      return {
                        field: f.name_field + "1",
                        fieldtype: f.fieldtype,
                      };
                    }),
                    customField: fields,
                    provider: provider.vp,
                    featureCount: featCount.numberOfFeatures,
                    getSearchColumns: function (this) {
                      return this.searchColumns.map((s) => s.field);
                    },
                  };
                  result.displayedColumns.unshift("select");
                  result.searchColumns.unshift({
                    field: "select1",
                    fieldtype: "text",
                  });
                  result.searchColumns.map((val) => {
                    this.form.setControl(val.field, new FormControl(null), {
                      emitEvent: false,
                    });
                  });
                  this.isLoadingResults = false;
                  return result;
                })
              );
          })
        );
      }),
      shareReplay(1)
    );

    const onSortChange: Subject<Sort> = new Subject<Sort>();
    this.onSortChangeInstance = (e: Sort) => {
      onSortChange.next(e);
    };

    const onPageChange: Subject<PageEvent> = new Subject<PageEvent>();
    this.onPageChangeInstance = (e: PageEvent) => {
      onPageChange.next(e);
    };

    this.data$ = merge(
      onSortChange,
      onPageChange,
      this.loadingTable$,
      this.form.valueChanges,
      onValid.pipe(
        switchMap((cell) => {
          this.editable = false;
          this.cell = {
            id: cell.id,
            column: cell.column,
          };
          let layer = this.inputData[0];
          if (layer.providers[0].vp.source == "sigfile") {
            let data = {
              id: cell.value["id"],
              field_name: cell.column,
              value: cell.value[cell.column],
              table: layer.providers[0].vp.table,
              schema: layer.providers[0].vp.shema,
              layer_id: layer.layer_id,
            };

            let dataTransaction: ResultOfDigitalise = {
              updates: [],
              deletes: [],
              inserts: [],
            };
            let updatedFeatures = new OlFeature();
            updatedFeatures.setId(data.id);
            updatedFeatures.setProperties({
              [data.field_name]: (!data.value || data.value == '' || data.value == 'NULL') ? null : data.value,
            });
            dataTransaction.updates.push(updatedFeatures);
            const transaction = mapsService.generateTransaction(
              dataTransaction.inserts,
              dataTransaction.updates,
              dataTransaction.deletes,
              layer.providers[0].vp.id_server
            )
            let query =
              "map=" +
              layer.providers[0].vp.path_qgis +
              "&SERVICE=WFS&VERSION=1.1.0&TYPENAME=" +
              layer.providers[0].vp.id_server;

            return this.mapsService.manageFeatures(query, {
              base_transaction: transaction
            }).pipe(
              catchError((error: HttpErrorResponse) => {
                this.isLoadingResults = false;

                this.notifierService.notify(
                  "error",
                  error.error?.msg
                    ? error.error.msg
                    : this.translate.instant("map.edit.error_saving_layer")
                );
                this.selection.clear();
                return EMPTY;
              })
            );
          } else {
            this.notifier.notify(
              "error",
              this.translate.instant("layer.error_updating_entity.query_source")
            );
            return EMPTY;
          }
        })
      ),
      onUpdateSelection.pipe(
        withLatestFrom(this.loadingTable$),
        switchMap(([evt, loadingTable]) => {
          let ids = [];
          this.selection.selected.map((feature_id) => {
            ids.push(parseInt(feature_id.split(".")[1]));
          });
          let columns = [];
          let layer = this.inputData[0];
          loadingTable.customField.forEach((element) => {
            if (element.name_field != "id") {
              columns.push({
                column: element.name_field,
                type: element.fieldtype,
              });
            }
          });

          return this.dialog
            .open(UpdateMultipleComponent, {
              disableClose: true,
              width: "40%",
              data: { columns: columns, layer: layer, ids: ids },
            })
            .afterClosed()
            .pipe(
              tap(() => {
                this.selection.clear();
              })
            );
        })
      ),
      onUpdateData.pipe(
        switchMap(() => {
          let layer = this.inputData[0];
          return this.dialog
            .open(UpdateJoinTableComponent, {
              disableClose: true,
              width: "90%",
              data: {
                layer_id: layer.layer_id,
                join_tables: layer.providers[0].vp.join_tables,
              },
            })
            .afterClosed()
            .pipe(
              tap(() => {
                this.selection.clear();
              })
            );
        })
      ),
      onDeleteSelection.pipe(
        switchMap(() => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant(
                "layer.confirm_remove_entity"
              ),
              confirmationExplanation:
                this.selection.selected.length > 1
                  ? this.translate.instant("layer.remove_features", {
                      number: this.selection.selected.length,
                    })
                  : this.translate.instant("layer.remove_feature"),
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant("delete"),
              danger: true,
            })
            .pipe(
              filter((resultConfirmation) => resultConfirmation),
              switchMap(() => {
                let layer = this.inputData[0];

                let data: ResultOfDigitalise = {
                  updates: [],
                  deletes: [],
                  inserts: [],
                };

                this.selection.selected.map((feature_id) => {
                  let deletedFeature = new OlFeature();
                  deletedFeature.setId(feature_id);
                  data.deletes.push(deletedFeature);
                });

                let requestWfs: Node = new WFS().writeTransaction(
                  data.inserts,
                  data.updates,
                  data.deletes,
                  {
                    featureNS: "http://www.opengis.net/wfs",
                    featurePrefix: "",
                    featureType: layer.providers[0].vp.id_server,
                    nativeElements: [],
                  }
                );

                const serializer = new XMLSerializer();
                const xmlStr = serializer.serializeToString(requestWfs);

                const transaction = mapsService.generateTransaction(
                  data.inserts,
                  data.updates,
                  data.deletes,
                  layer.providers[0].vp.id_server
                )
                let query =
                  "map=" +
                  layer.providers[0].vp.path_qgis +
                  "&SERVICE=WFS&VERSION=1.1.0&TYPENAME=" +
                  layer.providers[0].vp.id_server;

                return this.mapsService.manageFeatures(query, {
                  base_transaction: transaction
                }).pipe(
                  tap(() => {
                    this.notifierService.notify(
                      "success",
                     "Données supprimées avec succès"
                    );
                    this.selection.clear();
                  }),
                  catchError((error: HttpErrorResponse) => {
                    this.isLoadingResults = false;

                    this.notifierService.notify(
                      "error",
                      error.error?.msg
                        ? error.error.msg
                        : this.translate.instant("map.edit.error_saving_layer")
                    );
                    this.selection.clear();
                    return EMPTY;
                  })
                );
              })
            );
        })
      )
    ).pipe(
      withLatestFrom(this.loadingTable$),
      switchMap(([evt, loadingTable]) => {
        this.isLoadingResults = true;
        this.cdRef.detectChanges();
        let querry =
          "map=" +
          loadingTable.provider.path_qgis +
          "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&GEOMETRYNAME=none&OUTPUTFORMAT=application/json&TYPENAME=" +
          loadingTable.provider.id_server +
          "&MAXFEATURES=" +
          this.paginator.pageSize +
          "&STARTINDEX=" +
          this.paginator.pageIndex * this.paginator.pageSize +
          "&SORTBY=" +
          this.sort.active +
          " " +
          this.sort.direction.toUpperCase() +
          "&EXP_FILTER=" +
          encodeURIComponent(this.constructWFSFilter());

        return this.fieldService.getFeatures(querry).pipe(
          catchError((error) => {
            this.notifier.notify(
              "error",
              error.error?.msg
                ? error.error.msg
                : this.translate.instant(
                    "map.attribute_tables.error_getting_features"
                  )
            );
            this.isLoadingResults = false;
            return EMPTY;
          }),
          map((result) => {
            return {
              result: result,
              loadingTable: loadingTable,
            };
          })
        );
      }),
      map(({ result, loadingTable }) => {
        let features = result.features;
        
        features.forEach(feature => {
          for (let i=0; i < Object.keys(feature?.properties).length; i++) {
            if (feature?.properties[i].name == 'longitud_1') {
              feature.properties[i].value = feature?.properties[i]?.value?.replace('�', '°');
              break;
            }
          }
        });

        this.isLoadingResults = false;
        this.isRateLimitReached = features === null;
        this.resultsLength = features ? features.length : 0;
        this.formTable = this.formBuilder.group({
          rows: this.formBuilder.array(this.objectForm(features, loadingTable)),
        });

        return features;
      }),
      takeUntil(this.destroyed$)
    );

    const onZoom: Subject<void> = new Subject<void>();
    this.onZoomInstance = () => {
      onZoom.next();
    };

    const onDownload: Subject<string> = new Subject<string>();
    this.onDownloadInstance = (format: string) => {
      onDownload.next(format);
    };

    this.selectedFeatures$ = this.selection.changed.pipe(
      debounceTime(500),
      withLatestFrom(this.loadingTable$),
      switchMap(([selectionChange, loadingTable]) => {
        if (this.selection.selected.length > 0) {
          let selectedFeats = "";
          this.selection.selected.forEach((featId) => {
            selectedFeats += featId + ",";
          });
          let querry =
            "map=" +
            loadingTable.provider.path_qgis +
            "&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&TYPENAME=" +
            loadingTable.provider.id_server +
            "&FEATUREID=" +
            selectedFeats.slice(0, -1);

          return this.fieldService.getFeatures(querry).pipe(
            catchError((error) => {
              this.notifier.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant(
                      "map.attribute_tables.error_getting_features"
                    )
              );
              return EMPTY;
            }),
            tap((result) => {
              let highlightLayerData: CatalogueLayer = {
                type: "geojson",
                nom: "highlight",
                geometryType: result.features[0].geometry
                  .type as GeometryTypeProvider,
                cluster: false,
                data_geojson: result,
              };

              let cartoHelperClass = new CartoHelper(this.inputData[1]);
              let source_name = highlightLayerData.nom + "_maplibre_source";
              let layer_name = highlightLayerData.nom + "_maplibre_layer";

              if (
                cartoHelperClass.map.getSource(source_name) &&
                cartoHelperClass.map.getLayer(layer_name)
              ) {
                cartoHelperClass.map.removeLayer(layer_name);
                cartoHelperClass.map.removeSource(source_name);
              }
              let highlightLayer =
                cartoHelperClass.constructLayer(highlightLayerData);
              cartoHelperClass.map.addLayer(highlightLayer);
            })
          );
        } else {
          this.removeHighlightLayer();
          return EMPTY;
        }
      }),
      shareReplay(1)
    );

    onZoom
      .pipe(
        filter(() => this.selection.selected.length > 0),
        takeUntil(this.destroyed$),
        withLatestFrom(this.selectedFeatures$),
        tap(([_, selectedFeatures]) => {
          let map = this.inputData[1];
          let bboxExtent = bbox(selectedFeatures) as LngLatBoundsLike;
          map.fitBounds(bboxExtent);
        })
      )
      .subscribe();

    onDownload
      .pipe(
        withLatestFrom(this.loadingTable$),
        takeUntil(this.destroyed$),
        switchMap(([format, loadingTable]) => {
          this.isLoadingDownload = true;
          this.cdRef.detectChanges();
          let filter = "";
          if (this.selection.selected.length > 0) {
            filter = "&FEATUREID=";
            this.selection.selected.forEach((fid) => {
              filter += fid + ",";
            });
          }
          let querry =
            "map=" +
            loadingTable.provider.path_qgis +
            "&SERVICE=WFS&VERSION=1.3.0&REQUEST=GetFeature&OUTPUTFORMAT=" +
            format +
            "&TYPENAME=" +
            loadingTable.provider.id_server +
            filter;
          // return this.http.get(querry, { responseType: 'blob' }).pipe(
          return this.fieldService.downloadFeatures(querry).pipe(
            take(1),
            catchError((error: HttpErrorResponse) => {
              this.isLoadingDownload = false;
              this.notifier.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant(
                      "map.attribute_tables.error_download_features"
                    )
              );
              // Cacher le spinner et activer le bouton imprimer
              // this.showLoading = () => {
              //   return false;
              // }
              return EMPTY;
            }),
            tap((response) => {
              // It is necessary to create a new blob object with mime-type explicitly set
              // otherwise only Chrome works like it should
              var newBlob = new Blob([response]);

              // For other browsers:
              // Create a link pointing to the ObjectURL containing the blob.
              const data = window.URL.createObjectURL(newBlob);

              var link = document.createElement("a");
              link.href = data;
              let extension = format;
              if (extension == "shp") {
                extension = "zip";
              }
              link.download = loadingTable.provider.id_server + "." + extension;
              // this is necessary as link.click() does not work on the latest firefox
              link.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                })
              );

              setTimeout(function () {
                // For Firefox it is necessary to delay revoking the ObjectURL
                window.URL.revokeObjectURL(data);
                link.remove();
              }, 100);

              this.isLoadingDownload = false;
            })
          );
        })
      )
      .subscribe();
  }

  objectForm(
    features: Feature<
      Geometry,
      {
        [name: string]: any;
      }
    >[],
    loadingTable: AttributeTableInfo
  ): FormGroup[] {
    let array: FormGroup[] = [];
    features.forEach((feature) => {
      let properties = feature.properties as Array<any>;
      let obj = {};
      properties.forEach((property) => {
        loadingTable.displayedColumns.forEach((column) => {
          if (property.name == column) {
            obj[column] = new FormControl(property.value);
          }
        });
      });
      array.push(this.formBuilder.group(obj));
    });
    return array;
  }

  /**
   * Construct WFS filter from the this.form anular form
   * @returns string
   */
  constructWFSFilter = (): string => {
    const entries = Object.entries(this.form.value);
    let expFilter = "";
    entries.map((entry) => {
      let field = entry[0].slice(0, -1);
      if (entry[1]) {
        if (typeof entry[1] == "object") {
          if (expFilter == "") {
            expFilter +=
              "(" + field + entry[1]["sign"] + entry[1]["value"] + ")";
          } else {
            expFilter +=
              "and(" + field + entry[1]["sign"] + entry[1]["value"] + ")";
          }
        } else {
          if (expFilter == "") {
            expFilter +=
              '("' +
              field +
              "\"ILIKE'%25" +
              entry[1] +
              "%25'" +
              'OR"' +
              field +
              "\"ILIKE'" +
              entry[1] +
              "%25'" +
              'OR"' +
              field +
              "\"ILIKE '%25" +
              entry[1] +
              "'" +
              'OR"' +
              field +
              "\"ILIKE'" +
              entry[1] +
              "')";
          } else {
            expFilter +=
              'and("' +
              field +
              "\"ILIKE'%25" +
              entry[1] +
              "%25'" +
              'OR"' +
              field +
              "\"ILIKE'" +
              entry[1] +
              "%25'" +
              'OR"' +
              field +
              "\"ILIKE'%25" +
              entry[1] +
              "'" +
              'OR"' +
              field +
              "\"ILIKE'" +
              entry[1] +
              "')";
          }
        }
      }
    });
    return expFilter;
  };

  getValueOfColumn(column: string, feature: Feature): string {
    let prop = feature.properties as [];
    let proper = prop.find(
      (p) => p["name"] === column || p["alias_fr"] === column
    );
    return proper ? proper["value"] : "";
  }

  updateFilter() {
    this.filterDataStatus = !this.filterDataStatus;
    if (!this.filterDataStatus) {
      this.form.controls;
      const entries = Object.entries(this.form.controls);
      entries.map((entry) => {
        entry[1].setValue(null, { emitEvent: false });
      });
      entries[0][1].setValue(null);
    }
  }

  closeDialog(): void {
    this.removeHighlightLayer();
    this.dialogRef.close();
  }

  removeHighlightLayer(): void {
    let cartoHelperClass = new CartoHelper(this.inputData[1]);
    let source_name = "highlight_maplibre_source";
    let layer_name = "highlight_maplibre_layer";

    if (
      cartoHelperClass.map.getSource(source_name) &&
      cartoHelperClass.map.getLayer(layer_name)
    ) {
      cartoHelperClass.map.removeLayer(layer_name);
      cartoHelperClass.map.removeSource(source_name);
    }
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngAfterViewInit() {
    const dialogContent = document
      .querySelector(".dialog-content")
    if (dialogContent) {
      dialogContent.addEventListener("click", async (ev) => {
        this.editable = false;
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  /**
   * Change the window position: reduce or maximize it
   */
  changeWindowPosition() {
    if (this.windowPosition.value === "maximize") {
      this.windowPosition.next("minimize");
    } else {
      this.windowPosition.next("maximize");
    }
  }

  getFormControl(column: string, feature: Feature): FormControl {
    let prop = feature.properties as [];
    let proper = prop.find(
      (p) => p["name"] === column || p["alias_fr"] === column
    );
    let formControl = new FormControl(proper ? proper["value"] : "");
    return formControl;
  }

  getValue(column: string, feature: Feature) {
    let prop = feature.properties as Array<any>;
    return prop.find((p) => p["name"] === column || p["alias_fr"] === column) || EMPTY;
  }

  editField(event, element, column) {
    event.stopPropagation();
    this.editable = true;
    this.cell = {
      id: element,
      column: column,
    };
  }

  selectRow(id) {
    if (
      (this.store.user.is_superuser &&
        this.inputData[0].providers[0].vp.source != "sigfile") ||
      (!this.store.user.is_superuser && !this.inputData[0].write) ||
      (!this.store.user.is_superuser &&
        this.inputData[0].write &&
        this.inputData[0].providers[0].vp.source != "sigfile")
    ) {
      this.selection.toggle(id);
    }
  }


  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (event.target['classList'].contains('resizable-title')) {
      
      // For container
      const dialogRef = this.el.nativeElement.closest('.mat-dialog-container');
      this.startY = event.clientY;
      this.startHeight = dialogRef.offsetHeight;
      this.startTop = dialogRef.getBoundingClientRect().top;
      this.resizing = true;

      event.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.resizing) {
      const deltaY = this.startY - event.clientY;
      const newHeight = this.startHeight + deltaY;
      const minHeight = 0.5 * this.viewportHeight;
      if (newHeight > minHeight && newHeight <= this.viewportHeight) {
        // For container
        const dialogContainer = this.el.nativeElement.closest('.mat-dialog-container');
        if (dialogContainer) {
          const topPosition = this.startTop - deltaY;
          this.renderer.setStyle(dialogContainer, 'top', `${topPosition}px`);
          this.renderer.setStyle(dialogContainer, 'height', `${newHeight}px`);
          // For content
          this.tableHeight = newHeight - 45;
          this.tableHeightCss = `${this.tableHeight}px`;
        }
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.resizing) {
      this.resizing = false;
    }
  }
}
