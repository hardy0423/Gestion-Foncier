import {Component, Input, NgZone, OnInit, SimpleChanges} from '@angular/core';
import {LayerSpecification, Map, StyleSpecification} from 'maplibre-gl';
import {take, tap} from 'rxjs';
import {GeoDataService} from 'src/app/data/services/geo-data.service';
import {MapLibreEvent} from 'src/app/data/utils/maplibreEvent';
import {environment} from 'src/environments/environment';
import {BaseMaps} from 'src/helper/baseMaps';

///////////// les différents fonds de cartes dans les imagettes ///////////////

export interface imagettesOptions {
    style?: StyleSpecification | string;
    urlImage: string;
    nom: string;
    type: string;
    visible: boolean;
    id: number
    print_id: string
    layers?: Array<LayerSpecification>
}

export interface imagette_urlOptions {
    visible: boolean;
    url: string;
    titre: string;
}

@Component({
    selector: 'app-layer-switcher',
    templateUrl: './layer-switcher.component.html',
    styleUrls: ['./layer-switcher.component.scss'],
})
/**
 * Layer switcher between OSM Layer and IGN Aerial images
 */
export class LayerSwitcherComponent implements OnInit {
    @Input() left: string = '10px';
    @Input() bottom: string = '10px';
    @Input() map: Map;

    fakeMapTiler: Map;
    fakeMapTilerSatellite: Map;
    fakeMapTMSLocal: Map;
    fakeMapTMSLocalOSMFrance: Map
    fakeMapTMSLocalIGNMap: Map
    fakeMapWMTSMap: Map
    // isMaptilerBase: boolean = true;
    imagette: Array<imagettesOptions> = [];
    imagette_url: imagette_urlOptions = {
        visible: false,
        url: undefined,
        titre: undefined,
    };

    getActiveImagette() {
        return this.imagette.find((i) => i.visible == true)?.print_id
    }

    constructor(
        public ngZone: NgZone,
        public geoData: GeoDataService
    ) {

        this.fakeMapTMSLocalIGNMap = new Map({
            container: document.createElement('div'),
            style: null
        })
        this.fakeMapTMSLocalIGNMap.addSource('fakeMapTMSLocalIGNMap_source', {
            'type': 'raster',
            'tiles': ["https://data.geopf.fr/wmts?layer=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&style=normal&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}&zmax=19"],
            'tileSize': 256,
            'attribution': "© IGN France "
        })
        this.fakeMapTMSLocalIGNMap.addLayer({
            'id': 'fakeMapTMSLocalIGNMap_layer',
            'type': 'raster',
            'source': 'fakeMapTMSLocalIGNMap_source'
        })


        this.fakeMapTMSLocalOSMFrance = new Map({
            container: document.createElement('div'),
            style: null
        })
        this.fakeMapTMSLocalOSMFrance.addSource('fakeMapTMSLocalOSMFrance_source', {
            'type': 'raster',
            'tiles': ["https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"],
            'tileSize': 256,
            'attribution': "© OpenstreetMap France "
        })
        this.fakeMapTMSLocalOSMFrance.addLayer({
            'id': 'fakeMapTMSLocalOSMFrance_layer',
            'type': 'raster',
            'source': 'fakeMapTMSLocalOSMFrance_source'
        })

        this.fakeMapTMSLocal = new Map({
            container: document.createElement('div'),
            style: null
        })
        this.fakeMapTMSLocal.addSource('fakeMapTMSLocal_source', {
            'type': 'raster',
            'tiles': [environment.backendUrl + "/icons/ortho/v2/" + '{z}/{x}/{y}.webp'],
            "scheme": "tms",
            'tileSize': 256,
            'attribution': "© Vues aériennes 2023 de l'AEROPORT de BALE MULHOUSE "
        })
        this.fakeMapTMSLocal.addLayer({
            'id': 'fakeMapTMSLocal_layer',
            'type': 'raster',
            'source': 'fakeMapTMSLocal_source'
        })

        this.fakeMapTiler = new Map({
            container: document.createElement('div'),
            style: environment.maptilerStyle + environment.maptilerKey
        })

        this.fakeMapTilerSatellite = new Map({
            container: document.createElement('div'),
            style: environment.mapTilerImageryStyle + environment.maptilerKey
        })

        this.fakeMapWMTSMap = new Map({
            container: document.createElement('div'),
            style: null
        })
        this.fakeMapWMTSMap.addSource('fakeMapWMTSMap_source', {
            'type': 'raster',
            'tiles': ["https://data.geopf.fr/wmts?layer=ORTHOIMAGERY.ORTHOPHOTOS&style=normal&tilematrixset=PM&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}&zmax=19"],
            'tileSize': 256,
            'attribution': "© IGN France "
        })
        this.fakeMapWMTSMap.addLayer({
            'id': 'fakeMapWMTSMap_layer',
            'type': 'raster',
            'source': 'fakeMapWMTSMap_source'
        })
    }

    ngOnInit(): void {
    }

    ngOnChanges(changes: SimpleChanges): void {
        //Called before any other lifecycle hook. Use it to inject dependencies, but avoid any serious work here.
        //Add '${implements OnChanges}' to the class.
        if (changes['map']) {
            if (this.map) {
                this.imagette[0] = {
                    style: '',
                    nom: 'Aérien 2023',
                    print_id: "abm_2023",
                    id: 0,
                    type: 'fond',
                    visible: true,
                    urlImage: 'assets/images/basemaps/satellite.png'
                };
                this.imagette[1] = {
                    style: '',
                    nom: 'Plan',
                    print_id: "plan",
                    id: 1,
                    type: 'fond',
                    visible: false,
                    urlImage: 'assets/images/basemaps/plan.png'
                };
                this.imagette[2] = {
                    style: '',
                    nom: 'OSM France',
                    print_id: "osm_plan",
                    id: 2,
                    type: 'fond',
                    visible: false,
                    urlImage: 'assets/images/basemaps/openstreetmap_france.png'
                };
                this.imagette[3] = {
                    style: '',
                    nom: 'IGN Plan',
                    print_id: "ign_plan",
                    id: 3,
                    type: 'fond',
                    visible: false,
                    urlImage: 'assets/images/basemaps/ign_plan.png'
                };
                this.imagette[4] = {
                    style: '',
                    nom: 'ORTHO IGN',
                    print_id: "ortho_plan",
                    id: 4,
                    type: 'fond',
                    visible: false,
                    urlImage: 'assets/images/basemaps/satellite.png'
                };


                let mapLibreEvent = new MapLibreEvent()
                mapLibreEvent.fromMapLibreEvent(this.map, 'idle').pipe(
                    take(1),
                    tap(() => {
                        this.onImagetteChange()
                    })
                ).subscribe()
            }
        }
    }

    /**
     * Changer le fond de carte principal et ainsi l'iamgette aussi
     */
    onImagetteChange() {

        this.imagette.map((imagette) => {

            if (imagette.visible) {
                if (imagette.id == 0) {
                    imagette.layers = new BaseMaps(this.map).fakeMapTMSLocalStyle(this.fakeMapTMSLocal);
                }
                if (imagette.id == 1) {
                    imagette.layers = new BaseMaps(this.map).getMapTilerStyle(this.fakeMapTiler);
                }
                if (imagette.id == 2) {
                    imagette.layers = new BaseMaps(this.map).fakeMapTMSLocalStyle(this.fakeMapTMSLocalOSMFrance);
                }
                if (imagette.id == 3) {
                    imagette.layers = new BaseMaps(this.map).fakeMapTMSLocalStyle(this.fakeMapTMSLocalIGNMap);
                }
                if (imagette.id == 4) {
                    imagette.layers = new BaseMaps(this.map).fakeMapTMSLocalStyle(this.fakeMapWMTSMap);
                }
            }
        });

        this.imagette.filter((imagette) => imagette.visible).map((imagette) => {
            let layer_id = this.map.getStyle().layers[1]?.id;
            imagette.layers.map((layer) => {
                this.map.addLayer(layer, layer_id)
            })
        })

        // this.changer_url_imagette();
    }

    toggleSatelitte(id: number) {
        let fond = this.imagette.find((fond) => fond.id == id)
        if (fond) {
            this.imagette.map((fond) => fond.visible = false)
            fond.visible = true
            this.onImagetteChange()
        }
        // this.isMaptilerBase = !this.isMaptilerBase

    }

    changer_url_imagette() {
        this.imagette
            .filter((imagette) =>
                imagette.visible
            )
            .map((imagette) => {
                let cnv_prospect = document.createElement('canvas');
                let ctx = cnv_prospect.getContext('2d');
                let img_prospect = new Image();
                img_prospect.src = imagette.urlImage;
                img_prospect.onload = () => {
                    document
                        .querySelector('#fond_swicther_img')
                        .classList.add('transitioning-src');
                    setTimeout(() => {
                        this.imagette_url.visible = !imagette.visible;
                        this.imagette_url.titre = imagette.nom;
                        this.imagette_url.url = imagette.urlImage;
                        try {
                            document
                                .querySelector('#fond_swicther_img')
                                .classList.remove('transitioning-src');
                        } catch (error) {
                        }
                    }, 400);
                };
            });
    }
}
