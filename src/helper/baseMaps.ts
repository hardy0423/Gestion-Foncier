import { LayerSpecification, Map } from "maplibre-gl";
import { getWidth } from "ol/extent.js";
import { get as getProjection } from "ol/proj.js";
import WMTS from "ol/source/WMTS.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import { StyleService } from "src/app/data/services/style.service";
import { TileLayer } from "src/app/ol-module";
import { environment } from "src/environments/environment";
import { AppInjector } from "./app-injector.helper";

import MapboxVector from "ol/layer/MapboxVector";
// import MapBox

export class BaseMaps {
  styleService: StyleService = AppInjector.get(StyleService);

  constructor(public map?: Map) {}

  fakeMapTMSLocalStyle(fakemap: Map): LayerSpecification[] {
    let sourceToRemove = [];
    this.map
      .getStyle()
      .layers.filter(
        (layer: LayerSpecification) =>
          (layer.type != "background" && ["openmaptiles",'maplibre'].indexOf(layer.source) != -1 ) ||
          layer.id.includes("fakeMapTMS") ||
          layer.id.includes("fakeMapWMTS")
      )
      .map((layer) => {
        this.map.removeLayer(layer.id);
        sourceToRemove.push(layer["source"]);
      });

    sourceToRemove.map((source) => {
      try {
        this.map.removeSource(source);
      } catch (e) {}
    });

    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }

    let sourceList = fakemap
      .getStyle()
      .layers.map((layer) => {
        return layer["source"] as string;
      })
      .filter(onlyUnique)
      .map((source) => {
        return fakemap.getSource(source);
      })
      .map((source) => {
        this.map.addSource(source.id, source.serialize());
      });
    return fakemap.getStyle().layers;
  }

  getIgnStyle(fakemap: Map): LayerSpecification[] {
    let sourceToRemove = [];
    this.map
      .getStyle()
      .layers.filter(
        (layer: LayerSpecification) =>
          layer.type != "background" && layer.source == "openmaptiles"
      )
      .map((layer) => {
        this.map.removeLayer(layer.id);
        sourceToRemove.push(layer["source"]);
      });

    sourceToRemove.map((source) => {
      try {
        this.map.removeSource(source);
      } catch (e) {}
    });

    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }

    let sourceList = fakemap
      .getStyle()
      .layers.filter((layer: LayerSpecification) => layer.type != "background")
      .map((layer) => {
        return layer["source"] as string;
      })
      .filter(onlyUnique)
      .map((source) => {
        return fakemap.getSource(source);
      })
      .map((source) => {
        this.map.addSource(source.id, source.serialize());
      });
    return fakemap.getStyle().layers;
  }

  getMapTilerStyle(fakemap: Map): LayerSpecification[] {
    let sourceToRemove = [];
    this.map
      .getStyle()
      .layers// .filter((layer: LayerSpecification) => layer.type != 'background' && layer.source == 'satellite')
      .filter(
        (layer: LayerSpecification) =>
          (layer.type != "background" &&
            ["openmaptiles", "satellite"].includes(layer.source)) ||
          layer.id.includes("fakeMapTMS") ||
          layer.id.includes("fakeMapWMTS")
      )
      .map((layer) => {
        this.map.removeLayer(layer.id);
        sourceToRemove.push(layer["source"]);
      });

    sourceToRemove.map((source) => {
      try {
        this.map.removeSource(source);
      } catch (e) {}
    });

    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }
    let sourceList = fakemap
      .getStyle()
      .layers.filter(
        (layer: LayerSpecification) =>
          layer.type != "background" && layer.source != "satellite"
      )
      .map((layer) => {
        return layer["source"] as string;
      })
      .filter(onlyUnique)
      .map((source) => {
        return fakemap.getSource(source);
      })
      .map((source) => {
        this.map.addSource(source.id, source.serialize());
      });

    let layers = fakemap
      .getStyle()
      .layers.filter(
        (layer: LayerSpecification) =>
          layer.type != "background" && layer.source != "satellite"
      );
    return layers;
  }

  getIgnLayerOl(): TileLayer<WMTS> {
    // let mapToInteract : OlMap
    // if(map) {
    //   mapToInteract = map
    // } else {
    //   mapToInteract = this.map
    // }
    var resolutions = [];
    var matrixIds = [];
    var proj3857 = getProjection("EPSG:3857");
    var maxResolution = getWidth(proj3857.getExtent()) / 256;

    for (var i = 0; i < 22; i++) {
      matrixIds[i] = i.toString();
      resolutions[i] = maxResolution / Math.pow(2, i);
    }

    var tileGrid = new WMTSTileGrid({
      origin: [-20037508, 20037508],
      resolutions: resolutions,
      matrixIds: matrixIds,
    });

    var ign_source = new WMTS({
      url: "https://data.geopf.fr/wmts",
      layer: "ORTHOIMAGERY.ORTHOPHOTOS",
      matrixSet: "PM",

      format: "image/jpeg",
      projection: "EPSG:3857",
      tileGrid: tileGrid,
      style: "normal",
      crossOrigin: "anonymous",
      attributions:
        '© <a target="_blank" href="http://www.geoportail.fr/">IGN</a> - Photographies aériennes <a target="_blank" href="https://www.geoportail.gouv.fr/depot/fiches/photographiesaeriennes/geoportail_dates_des_prises_de_vues_aeriennes.pdf">  dates de prise de vue</a>',
    });

    var ign = new TileLayer({
      source: ign_source,
      zIndex: 1,
      // minResolution: mapToInteract.getView().getResolutionForZoom(22),
    });
    ign.set("zMax", 22);
    return ign;
  }

  getMapLibreLayerOl(): MapboxVector {
    let layer = new MapboxVector({
      styleUrl: environment.maptilerStyle + environment.maptilerKey,
    });

    return layer;
  }
}
