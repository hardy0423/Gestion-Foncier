import { Component, Input, OnInit, SimpleChanges } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import maplibregl, { Map } from "maplibre-gl";
import { Coordinate } from "ol/coordinate";
import {
  catchError,
  EMPTY,
  filter,
  map,
  merge as observerMerge,
  Observable,
  ReplaySubject,
  switchMap,
  takeUntil,
  Subscription,
} from "rxjs";
import { GroupWithLayers, Layer } from "src/app/data/models/type";
import { BackendApiService } from "src/app/data/services/backend-api.service";
import { ParametersService } from "src/app/data/services/parameters.service";
import { SearchLayerService } from "src/app/data/services/search-layer.service";
import { handleEntitySearch } from "./handle-entity-search";
import { handleLayerSearch } from "./handle-layer-search";
import { handleParcelleSearch } from "./handle-parcelle-search";
import { FullscreenService } from "src/app/data/services/fullscreen.service";

export interface filterOptionInterface {
  name?: string;
  id: number;
  typeOption?: string;
  icon?: string;
  layer?: Layer;
  number?: number;
  coordinates_3857?: Coordinate;
  [key: string]: any;
  commune?: string;
  idu?: string;
  nom_commune?: string;
  parcelle?: string;
  proprietaire?: string;
  section?: number;
  surface?: number;
}

@Component({
  selector: "app-search-bar",
  templateUrl: "./search-bar.component.html",
  styleUrls: ["./search-bar.component.scss"],
})
export class SearchBarComponent implements OnInit {
  public onInitInstance: () => void;
  popup = new maplibregl.Popup({ closeOnClick: false });

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  @Input() map: Map;
  @Input() handle: string[];
  @Input() groups: GroupWithLayers[];

  /**
   * forms use to choose emprise to make the download
   */
  form: FormGroup;
  /**
   * list of all filtterd option
   */
  filterOptions: { [key: string]: Array<filterOptionInterface> } = {
    parcelle: [],
    layer: [],
    entity: [],
  };

  objectsIn = Object.keys;

  isFullscreen = false;
  private fullscreenSubscription: Subscription;
  
  constructor(
    public fb: FormBuilder,
    public BackendApiService: BackendApiService,
    public searchLayerService: SearchLayerService,
    public parametersService: ParametersService,
    private fullscreenService: FullscreenService
  ) {
    let empriseControl = new FormControl("", [Validators.minLength(2)]);

    this.form = this.fb.group({
      searchWord: empriseControl,
    });

    empriseControl.valueChanges
      .pipe(
        takeUntil(this.destroyed$),
        filter((value) => typeof value === "string" && empriseControl.valid),
        switchMap((querry: string) => {
          return observerMerge(...this.getQuerryForSerach(querry)).pipe(
            catchError(() => {
              return EMPTY;
            })
          );
        }),
        map((response) => {
          if (response.type == "layer") {
            this.filterOptions["layer"] =
              new handleLayerSearch().formatDataForTheList(response.value);
          } else if (response.type == "entity") {
            this.filterOptions["entity"] =
              new handleEntitySearch().formatDataForTheList(response.value);
          } else if (response.type == "parcelle") {
            this.filterOptions["parcelle"] =
              new handleParcelleSearch().formatDataForTheList(response.value);
          }
          this.cleanFilterOptions();
        })
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.fullscreenSubscription = this.fullscreenService.fullscreen$.subscribe(isFullscreen => {
      this.isFullscreen = isFullscreen;
    });
   }

  ngOnDestroy() {
    this.destroyed$.next(true);
    this.destroyed$.complete();
    if (this.fullscreenSubscription) {
      this.fullscreenSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["map"]) {
      if (this.map) {
        this.popup.addTo(this.map);
        // var cartoClass = new CartoHelper(this.map)
        // if (cartoClass.getLayerByName('searchResultLayer').length > 0) {
        //   this.searchResultLayer = cartoClass.getLayerByName('searchResultLayer')[0]
        //   this.searchResultLayer.setZIndex(1000)
        // } else {
        //   this.searchResultLayer.setZIndex(1000)
        //   cartoClass.map.addLayer(this.searchResultLayer)
        // }
        // if (cartoClass.getLayerByName('searchResultLayer').length > 0) {
        //   cartoClass.getLayerByName('searchResultLayer')[0].getSource().clear()
        // }
      }
    }
  }

  /**
   * get querry for search
   * TO BE AMELIORATE WITH ENVIRONMENT VARIABLE
   * @param value string text to search
   */
  getQuerryForSerach(
    value: string
  ): Observable<{ type: String; error: boolean; value: any }>[] {
    var querryObs: Observable<{ type: String; error: boolean; value: any }>[] =
      [];
    if (this.handle.includes("layer")) {
      querryObs.push(
        this.searchLayerService.searchLayer(value).pipe(
          map((layer) => {
            return { type: "layer", value: layer, error: false };
          }),
          catchError(() => {
            return EMPTY;
          })
        )
      );
    }

    if (this.handle.includes("entity")) {
      querryObs.push(
        this.searchLayerService.searchEntity(value).pipe(
          map((layer) => {
            return { type: "entity", value: layer, error: false };
          }),
          catchError(() => {
            return EMPTY;
          })
        )
      );
    }
    if (this.handle.includes("parcelle")) {
      querryObs.push(
        this.searchLayerService.searchParcelle(value).pipe(
          map((layer) => {
            return { type: "parcelle", value: layer, error: false };
          }),
          catchError(() => {
            return EMPTY;
          })
        )
      );
    }
    return querryObs;
  }

  /**
   * Function use to display information of a selected option
   * @param option filterOptionInterface
   * @retun string
   */
  displayAutocompleteFn(option: filterOptionInterface): string {
    if (option.typeOption == "layer") {
      return new handleLayerSearch().displayWith(option);
    } else if (option.typeOption == "entity") {
      return new handleEntitySearch().displayWith(option);
    } else if (option.typeOption == "parcelle") {
      return new handleParcelleSearch().displayWith(option);
    }
    return null;
  }

  /**
   * Funtion call when user select an option
   * @param selected MatAutocompleteSelectedEvent
   */
  optionAutocompleteSelected(selected: MatAutocompleteSelectedEvent) {
    var option: filterOptionInterface = selected.option
      ? selected.option.value
      : undefined;
    if (option) {
      if (option.typeOption == "layer") {
        new handleLayerSearch().optionSelected(option, this.map);
        this.clearSearch();
      } else if (option.typeOption == "entity") {
        new handleEntitySearch().optionSelected(option, this.map);
        this.clearSearch();
      } else if (option.typeOption == "parcelle") {
        new handleParcelleSearch().optionSelected(option, this.map, this.popup);
        // this.clearSearch();
      }
    }
  }

  /**
   * clean filterOptions data
   * - if an option have no value, clean it
   * - order how data are display
   */
  cleanFilterOptions() {
    for (const key in this.filterOptions) {
      if (this.filterOptions.hasOwnProperty(key)) {
        const element = this.filterOptions[key];
        if (element.length == 0) {
          this.filterOptions[key] = [];
        }
      }
    }
  }

  /**
   * clear search : set seach input to '' and clean layer source
   */
  clearSearch() {
    this.form.get("searchWord").patchValue("");

    if (
      this.handle.includes("parcelle") &&
      this.map.getSource("land-search-source") &&
      this.map.getLayer("land-search-layer")
    ) {
      this.popup.remove();
      this.map.removeLayer("land-search-layer");
      this.map.removeSource("land-search-source");
    }
  }
}
