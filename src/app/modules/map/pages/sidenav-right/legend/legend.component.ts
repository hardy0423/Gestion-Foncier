import { Component, Input, OnInit, SimpleChanges } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import * as $ from "jquery";
import { Map } from "maplibre-gl";
import { ReplaySubject } from "rxjs";
import { takeUntil, tap } from "rxjs/operators";
import { GeoDataService } from "src/app/data/services/geo-data.service";
import { CartoHelper, layersInMap } from "src/app/data/utils/cartoHelper";
import { MapLibreEvent } from "src/app/data/utils/maplibreEvent";

@Component({
  selector: "app-legend",
  templateUrl: "./legend.component.html",
  styleUrls: ["./legend.component.scss"],
})
/**
 * handle legend of layers in the TOC
 */
export class LegendComponent implements OnInit {
  @Input() map: Map;

  layersInTocWithLegend: Array<layersInMap> = [];
  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public DomSanitizer: DomSanitizer,
    public geoData: GeoDataService
  ) {}

  ngOnInit(): void {}

  ngOnDestroy() {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["map"]) {
      if (this.map) {
        let mapLibreEvent = new MapLibreEvent();
        mapLibreEvent
          .fromMapLibreEvent(this.map, "idle")
          .pipe(
            tap(() => {
              this.getAllLayersLegends();
            }),
            takeUntil(this.destroyed$)
          )
          .subscribe();
      }
    }
  }

  /**
   * Construct the array this.layersInTocWithLegend array.
   */

  getAllLayersLegends() {
    this.layersInTocWithLegend = new CartoHelper(this.map)
      .getAllLayersInToc()
      .filter(
        (layerProp) =>
          layerProp.type_layer == "geosmCatalogue" &&
          layerProp.properties.type == "couche"
      )
      .filter((value, index, self) => {
        /**
         * unique layer ^^
         */
        return (
          self
            .map((item) => item.properties.couche_id + item.properties.type)
            .indexOf(value.properties.couche_id + value.properties.type) ===
          index
        );
      })
      .map((layerProp) => {
        if (layerProp.properties.type == "couche") {
        }
        let layer = this.geoData.getLayerInMap(
          layerProp.properties.couche_id
        ).layer;
        layerProp.legendCapabilities = [];
        layer.providers
          .filter((provider) => {
            return (
              provider.vp.state == "good" && provider.vp.id_server != undefined
            );
          })
          .map((provider) => {
            layerProp.legendCapabilities.push({
              description: provider.vs.description,
              urlImg: $.trim(
                provider.vp.url_server +
                  "&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=" +
                  provider.vp.id_server +
                  "&STYLE=" +
                  provider.vs.name +
                  "&SLD_VERSION=1.1.0&LAYERTITLE=false&RULELABEL=true"
              ),
            });
          });

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
    this.layersInTocWithLegend.sort(compare);
  }
}
