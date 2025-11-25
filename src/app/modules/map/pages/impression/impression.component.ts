import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl,FormGroup } from '@angular/forms';
import {  boundingExtent ,getArea,buffer,getSize, Extent} from 'ol/extent.js';
import Polygon from 'ol/geom/Polygon.js';
import Draw, {createRegularPolygon, createBox} from 'ol/interaction/Draw.js';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
import {OSM, Vector as VectorSource} from 'ol/source.js';
import {  getPointResolution,transformExtent,get as getProjection, fromLonLat } from 'ol/proj.js';
import { Map,MercatorCoordinate } from "maplibre-gl";

import { catchError, map, take, tap } from 'rxjs/operators';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import * as turf from '@turf/turf'
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { EMPTY } from 'rxjs';
import { ANIMATION_MODULE_TYPE } from '@angular/platform-browser/animations'
import { environment } from 'src/environments/environment';
import { MapLibreEvent } from 'src/app/data/utils/maplibreEvent';
import { ActivatedRoute } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { TranslateService } from '@ngx-translate/core';

export interface Layout{
  'nom':string,
  'code': number
  'nom_template':string,
  'size':[number,number],
}

@Component({
  selector: 'app-impression',
  templateUrl: './impression.component.html',
  styleUrls: ['./impression.component.scss'],
  providers: [
    { provide: ANIMATION_MODULE_TYPE, useValue: 'BrowserAnimations' },
  ]
})


export class ImpressionComponent implements OnInit {

  @Input()  map: Map;
  
  @Input() getListLayerToPrint:()=>Array<{id: number, layer_project: string}>
  @Input() background:()=>string
  @Input()  profil: any;

  @ViewChild('PrintFrame') PrintFrame:ElementRef<HTMLBaseElement>

  extent_carte_situation:Extent
  echelle = 500
  echelles:Array<{
      'nom':string,
      'echelle':number,
      'formats': number[]
  }>
  layoutScales:Array<{
    'nom':string,
    'echelle':number,
    'formats': number[]
}>
  extent_feature:Extent
  url_qgis:string
  toogle = false
  echelle_carte:number
  identifiant_fdp_wms:string
  layout:{
    templates:Layout[],
    grid:boolean
  }={
    'templates':[],
    'grid':true
  }

  layout_choisi={
    'templates':{} as Layout,
    'description':'',
    'titre':'',
    'fond':true,
    'with_legend':false,
    'fond_exist':false,
    'rotation':0,
  }
  impressionControl = new FormGroup({
    'rotation': new FormControl(0, []),
  });
  carte_base:{
    id_osm_wms:string
    id_ign_wms:string
    id_satelite_wms:string
  }

  scalesForm: FormGroup

  /**
   * should we display the loading of print process ?
   */
  showLoading:()=>boolean

  constructor(
    private http: HttpClient,
    public fb: FormBuilder,
    public activatedRoute: ActivatedRoute,
    private notifier:NotifierService,
    public translate: TranslateService
  ) {
    
    this.echelles = [
      {
        'nom':'1/15000',
        'echelle':15000,
        'formats': [4,3]
      },
      {
        'nom':'1/10000',
        'echelle':10000,
        'formats': [4,3,2]
      },
      {
        'nom':'1/8000',
        'echelle':8000,
        'formats': [4,3,2]
      },
      {
        'nom':'1/5000',
        'echelle':5000,
        'formats': [4,3,2]
      },
      {
        'nom':'1/4000',
        'echelle':4000,
        'formats': [4,3,2,1]
      },
      {
        'nom':'1/3500',
        'echelle':3500,
        'formats': [4,3,2,1,0]
      },
      {
        'nom':'1/3000',
        'echelle':3000,
        'formats': [0,2,3,4,1]
      },
      {
        'nom':'1/2500',
        'echelle':2500,
        'formats': [0,2,3, 4,1]
      },
      {
        'nom':'1/2000',
        'echelle':2000,
        'formats': [0,2, 3, 4,1]
      },
      {
        'nom':'1/1500',
        'echelle':1500,
        'formats': [0,2, 3, 4,1]
      },
      {
        'nom':'1/1250',
        'echelle':1250,
        'formats': [0,1, 2, 3, 4]
      },
      {
        'nom':'1/1000',
        'echelle':1000,
        'formats': [0,1, 2, 3, 4]
      }
      ,
      {
        'nom':'1/800',
        'echelle':800,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/600',
        'echelle':600,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/500',
        'echelle':500,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/450',
        'echelle':450,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/400',
        'echelle':400,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/350',
        'echelle':350,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/300',
        'echelle':300,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/250',
        'echelle':250,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/200',
        'echelle':200,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/150',
        'echelle':150,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/100',
        'echelle':100,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/50',
        'echelle':50,
        'formats': [0, 1, 2, 3, 4]
      },
      {
        'nom':'1/25',
        'echelle':25,
        'formats': [0, 1, 2, 3, 4]
      }
    
    ]
   }

  ngOnInit() {
    this.impressionControl.controls['rotation'].valueChanges.subscribe(value => {
      // this.map.getView().setRotation((value)* Math.PI / 180)
      this.layout_choisi.rotation = value
    });
    this.initialise_impression()
    this.showLoading = () => {
      return false;
    }
  }

  setMap(map:Map) {
    this.map = map;

  }

  rotatePrint(sens:'left'|'right')
  {
    if (sens == 'left') {
      this.layout_choisi.rotation = this.layout_choisi.rotation +15
    } else {
      this.layout_choisi.rotation = this.layout_choisi.rotation -15
    }
  }

  getRotate(){ 
    return 'rotate('+this.layout_choisi.rotation+'deg)'
    // return 'rotate(0deg)'
  }
  
  initialise_impression(){
    // this.url_qgis = url_qgis
    // this.identifiant_fdp_wms = identifiant_fdp_wms
    // this.extent_carte_situation = extent
    // if (config.carte_base) {
      // this.layout_choisi.fond_exist = true
      // this.carte_base = config

      if (this.profil['profil'] == 2) {
        this.layout.templates.push({
          'nom':'Fiabilisation Foncière',
          'code': 3,
          'nom_template':'fiabilisation_fonciere',
          'size':[340.985, 232.585],
          
        })
  
        this.layout.templates.push({
          'nom':'Mise à disposition',
          'code': 3,
          'nom_template':'mise_a_disposition',
          'size':[340.985, 232.585],
          
        })
  
        this.layout.templates.push({
          'nom':'Plan d\'actions correctives',
          'code': 3,
          'nom_template':'plan_actions_correctives',
          'size':[340.985, 232.585],
          
        })
      }
      this.layout.templates.push(
        {
          'nom':'A4',
          'code': 4,
          'nom_template':'template_a4',
          'size':[290,181],
        }
      )
      this.layout.templates.push({
        'nom':'A3',
        'code': 3,
        'nom_template':'template_a3',
        'size':[412.483, 268.124],
        
      })

      this.layout.templates.push({
        'nom':'A2',
        'code': 2,
        'nom_template':'template_a2',
        'size':[581.748, 385.668],
        
      })

      this.layout.templates.push({
        'nom':'A1',
        'code': 1,
        'nom_template':'template_a1',
        'size':[823.110, 546.576],
        
      })

      this.layout.templates.push({
        'nom':'A0',
        'code': 0,
        'nom_template':'template_a0',
        'size':[1161.810, 770.463],
        
      })
    // }

  }

  echelle_change(){
    // this.set_map_zoom_for_scale()
    this.recomputeBox()
  }

  format_change(){
    // this.set_map_zoom_for_scale()
    this.changeScale()

    this.recomputeBox()
  }

  changeScale() {

    this.layoutScales = this.echelles.filter((scale) => {
      return scale.formats.includes(this.layout_choisi.templates.code)
    })

    this.echelle = this.layoutScales[0].echelle
  }

  mapScale(dpi = 25.4 / 0.28) {
    // this.map.getSc
    // var unit = this.map.getView().getProjection().getUnits();
    // var resolution = this.map.getView().getResolution();
    // var inchesPerMetre = 39.37;
  
    // return resolution * METERS_PER_UNIT[unit] * inchesPerMetre * dpi;
    const y = this.map.getCanvas().height;
    const x = this.map.getCanvas().width;
    const left = this.map.unproject([0, y]);
    const bottom = this.map.unproject([x, y]);
    const maxMeters = turf.distance(turf.point([left.lng, left.lat]), turf.point([bottom.lng, bottom.lat]), { units: 'miles' }) * 1609.344;
    const metersPerPixel = (maxMeters / x);
    const metersOnScreen = metersPerPixel * window.screen.availWidth;
    const scale = metersOnScreen / 0.28;
    return scale;

  }

  recomputeBox(){
   
    this.echelle_carte = Math.round(this.mapScale())
    var mapSize = [parseFloat(this.map.getCanvas().style.width.replace('px', '')) , parseFloat(this.map.getCanvas().style.height.replace('px', ''))]
    // this.map.getCanvas().center
    // var view = this.map.getView();
    var coords = [this.map.getCenter().lng,this.map.getCenter().lat];
    
    // var center_pixel = this.map.getPixelFromCoordinate(coords);
    // const screenPixelRatio = window.devicePixelRatio; //this.map.getPixelRatio()
    const screenPixelRatio =this.map.getPixelRatio() //this.map.getPixelRatio()
    // var resolution = view.getResolution();    
    var resolution = screenPixelRatio
    // var projection = view.getProjection();
    // var resolutionAtCoords = getPointResolution('EPSG:3857',resolution, coords);

    // const screenCanvas = this.map.getCanvas();
    // const screenDimensions = [screenCanvas.width / screenPixelRatio, screenCanvas.height / screenPixelRatio];
    // const printPixelRatio = dimensions[0] / screenDimensions[0];


    
    
    // var mapPointResolution = (this.echelle_carte * 25.4) / (resolution * 1000);

    // function metresPerPixelFun() {
      const southEastPoint = this.map.getBounds().getSouthEast();
      const northEastPoint = this.map.getBounds().getNorthEast();
      const mapHeightInMetres = southEastPoint.distanceTo(northEastPoint);
      const mapHeightInPixels = this.map.getContainer().offsetHeight;
      let metresPerPixel= mapHeightInMetres / mapHeightInPixels;
  // }
  // this.map.getCenter().
  const coord = new MercatorCoordinate(this.map.getCenter().lng, this.map.getCenter().lat, 0);
  const offsetInMeters = (this.echelle * this.layout_choisi.templates['size'][0])/1000;
  const offsetInMercatorCoordinateUnits = offsetInMeters * coord.meterInMercatorCoordinateUnits();
  const westCoord = new MercatorCoordinate(coord.x - offsetInMercatorCoordinateUnits, coord.y, coord.z);

    let tt = this.map.project([this.map.getCenter().lng,this.map.getCenter().lat])

    
    // var width2 = (this.echelle * this.layout_choisi.templates['size'][0]) / (screenPixelRatio * 1000) ;
    // var height2 = (this.echelle * this.layout_choisi.templates['size'][1]) / (screenPixelRatio * 1000);
    let facteur_echelle = 1/1.1
    if (this.echelle <= 800) {
      facteur_echelle = 1/1.58
    }else if (this.echelle <= 5000) {
      facteur_echelle = 1/1.5
    }else if (this.echelle > 5000 && this.echelle <= 7000){
      facteur_echelle = 1/1.45
    }else if (this.echelle > 7000 ){
      facteur_echelle = 1/1.4
    }
    var width2 = (this.echelle*facteur_echelle * this.layout_choisi.templates['size'][0])/metresPerPixel/1000
    var height2 = (this.echelle *facteur_echelle * this.layout_choisi.templates['size'][1])/metresPerPixel/1000

    // let metresPerPixel = 40075016.686 * Math.abs(Math.cos(this.map.getCenter().lat * Math.PI/180)) / Math.pow(2, this.map.getZoom()+8);
    // let metresPerPixel = metresPerPixelFun()


    // //var width2_icon = (this.echelle * 50) / (resolutionAtCoords * 1000) ;
    // //var height2_icon = (this.echelle *50) / (resolutionAtCoords * 1000);

    this.PrintFrame.nativeElement.style.width = width2+'px'
    this.PrintFrame.nativeElement.style.height = height2+'px'
    this.PrintFrame.nativeElement.style.left = (mapSize[0]/2 - width2/2)+'px'
    // this.PrintFrame.nativeElement.style.left = (mapSize[0]/2 - width2/2 - 356/2)+'px'
    this.PrintFrame.nativeElement.style.top = (mapSize[1]/2 - height2/2)+'px'
  
  }



  toogle_impression(){
    
    

    // this.BackendApiService.downloadPdf().subscribe(res => {
    //   const downloadFile = (blob, fileName) => {
    //     const link = document.createElement('a');
    //     // create a blobURI pointing to our Blob
    //     link.href = URL.createObjectURL(blob);
    //     link.download = fileName;
    //     // some browser needs the anchor to be in the doc
    //     document.body.append(link);
    //     link.click();
    //     link.remove();
    //     // in case the Blob uses a lot of memory
    //     window.addEventListener('focus', e=>URL.revokeObjectURL(link.href), {once:true});
    //   };
    //   downloadFile(res, "document.pdf");
    // })
    
    if (!this.toogle) {
      this.start_impression()
    } else {
      this.stop_impression()
    }    
    
  }

  // getZoomFromScale(scale:number):number{
  //   var units = this.map.getView().getProjection().getUnits();
  //   var dpi = 25.4 / 0.28;
  //   var mpu = METERS_PER_UNIT[units];
  //   var resolution = scale / (mpu * 39.37 * dpi);
  //   return this.map.getView().getZoomForResolution(resolution);
  // }

  // set_map_zoom_for_scale(){
  //   var extent_vieuw = this.map.getView().calculateExtent()
  //   var zoom = this.map.getView().getZoom()
  //   var poly_view = turf.toWgs84(turf.bboxPolygon(extent_vieuw));
  //   var area = turf.area(poly_view);
  //   var area_PrintFrame = this.layout_choisi.templates['size'][0]/1000*this.echelle*this.layout_choisi.templates['size'][1]/1000*this.echelle
  //   var facteur_echelle = area_PrintFrame/area
  //   if(area_PrintFrame >area ){
  //     var echelle_carte = this.mapScale()
  //     // this.map.getView().setZoom(this.MapGeneralService.getZoomFromScale(echelle_carte*facteur_echelle))
  //     this.map.getView().setZoom(this.getZoomFromScale(this.echelle)-2)
  //   }
  // }

  start_impression(){
    this.toogle = true
    this.layout_choisi.templates = this.layout.templates[0]

    this.changeScale()

    // this.set_map_zoom_for_scale()
    this.recomputeBox()
    new MapLibreEvent().fromMapLibreEvent(this.map, 'zoomstart').pipe(
      tap(()=>{
        this.recomputeBox()
      })
    ).subscribe()
  
  }

  stop_impression(){
    this.toogle = false
  }


  imprimer(){
    
    // Afficher le spinner de chargement et desactiver le bouton imprimer
    this.showLoading = () => {
      return true;
    }
    
    var layers_active = this.getListLayerToPrint()
    var layers_to_print = layers_active.map(l => l.id).join(',')
    // let styles:Array<string> = []
    // // si on veut ajouter les images aériennes
    // if (this.layout_choisi.fond_exist && this.layout_choisi.fond) {
    //   layers_to_print = this.carte_base.id_ign_wms+','+layers_to_print
    //   styles.push('')
    // }
    

    // for (let index = 0; index < layers_active.length; index++) {
    //   if ( layers_active[index] != this.identifiant_fdp_wms){
    //     styles.push('impression_850')
    //   }else{
    //     // styles.push('impression_400')
    //   }
    // }

    // var view = this.map.getView();
    // var coords = view.getCenter();
    // var resolution = view.getResolution();  
    // var projection = view.getProjection();
    // var resolutionAtCoords = getPointResolution(projection,resolution, coords);
    // var center_pixel = this.map.getPixelFromCoordinate(coords);
    let tt = this.map.project([this.map.getCenter().lng,this.map.getCenter().lat])
    var center_pixel = [tt.x,tt.y];
    var rect = document.getElementById('PrintFrame').getBoundingClientRect();
    var width = parseFloat(this.PrintFrame.nativeElement.style.width.replace('px',''))
    var height = parseFloat(this.PrintFrame.nativeElement.style.height.replace('px',''))
    
    // var facteur_echelle = resolution/resolutionAtCoords
    var facteur_echelle = 1
    
    var deg_to_radians = function(degrees:number) {
      return degrees * Math.PI / 180;
    };
    // Converts from radians to degrees.
    var radians_to_deg = function(radians:number) {
      return radians * 180 / Math.PI;
    };

    // var rayon = Math.sqrt(Math.pow(width, 2)/4 + Math.pow(height, 2)/4)
    // var angle_diagonale_rectangle = radians_to_deg(Math.atan( height/width ) +Math.PI)
    // var alpha = this.layout_choisi.rotation
    // var theta = angle_diagonale_rectangle-Math.abs(alpha)
  

    var x0 = this.layout_choisi.rotation > 0 && this.layout_choisi.rotation !=  90 ? rect.left - 540 
      : this.layout_choisi.rotation == 90 ? rect.left - 540
      : rect.left - 170;

    var y0 = this.layout_choisi.rotation > 0 && this.layout_choisi.rotation !=  90 ? rect.top
      : this.layout_choisi.rotation ==  90 ? rect.top
      : rect.top - 50

    var x1 = this.layout_choisi.rotation > 0 && this.layout_choisi.rotation !=  90 ? rect.right + 360
      : this.layout_choisi.rotation ==  90 ? rect.right + 280
      : rect.right - 50;

    // var y1 = y0 + height + 6.5 // La bordure de la div printFrame
    var y1 = this.layout_choisi.rotation > 0 && this.layout_choisi.rotation !=  90 ? rect.bottom + 100
      : this.layout_choisi.rotation ==  90 ? rect.bottom + 50
      : rect.bottom + 25;

    var pixelA0 = [x0,y0]
    var pixelA1 = [x1,y1]
    

    
    let t0 = fromLonLat(this.map.unproject([x0,y0]).toArray() as [number, number])
    let t1 = fromLonLat(this.map.unproject([x1,y1]).toArray() as [number, number])

    var coordA0 = fromLonLat(this.map.unproject([x0,y0]).toArray() as [number, number]);
    var coordA1 = fromLonLat(this.map.unproject([x1,y1]).toArray() as [number, number]);
    
    var print_extent = boundingExtent([coordA0,coordA1]) 
    var surface_extent = getSize(print_extent)


    
    var mapScale = this.echelle 
    var grid_interval = mapScale/10;

    // if (mapScale == 200) {
      // for (let index = 0; index < styles.length; index++) {
      //   if (styles[index] == 'défaut'){
      //     styles[index] = 'impression_400'
      //   };
      // }
    // }
    
    
    var printUrl = environment.backendUrl+
    '/api/provider/print?SERVICE=WMS&REQUEST=GetPrint&FORMAT=pdf&CRS=EPSG:3857&DPI='+
    '800'+'&TEMPLATE='+this.layout_choisi.templates['nom_template']+
    '&map0:extent='+print_extent.join(',')+
    '&map0:scale='+mapScale*facteur_echelle+
    '&map1:extent='+print_extent.join(',')+
    '&map1:scale='+((mapScale*facteur_echelle)+(mapScale*facteur_echelle*20))+
    '&title='+encodeURI(this.layout_choisi.titre)+
    '&description='+encodeURI(this.layout_choisi.description)+
    '&legend='+this.layout_choisi.with_legend.toString()+
    '&listLayerProviderStylePks='+layers_to_print+
    '&epsg='+'3857'+"&background="+this.background()+
    '&zoom='+this.map.getZoom();
    
    // if (this.layout.grid) {[%item_variables('Carte 1')['map_scale']%]
    //   printUrl = printUrl +'&map0:grid_interval_x='+grid_interval+'&map0:grid_interval_y='+grid_interval
    // }

    // // printUrl = printUrl +'&map1:extent='+print_extent.join(',')+'&map1:scale='+mapScale+'&map1:LAYERS='+'Fond de plan'
    // var extent_map_situation = buffer(print_extent,this.echelle/2)
    // if (this.echelle < 200) {
    //   var extent_map_situation = buffer(print_extent,250/2)
    // }
    // printUrl = printUrl +'&map1:extent='+extent_map_situation.join(',')+'&map1:LAYERS='+this.carte_base.id_osm_wms+'&map1:STYLES='
    // // printUrl = printUrl +'&map1:extent='+extent_map_situation.join(',')+'&map1:LAYERS='+this.identifiant_fdp_wms+'&map1:STYLES=gray'
    // // printUrl = printUrl +'&map1:extent='+extent_map_situation.join(',')+'&map1:LAYERS='+this.identifiant_fdp_wms+'&map1:STYLES=défaut'
    
    // printUrl = printUrl +'&titre='+encodeURI(this.layout_choisi.titre)+'&description='+encodeURI(this.layout_choisi.description)

    // // si on veut ajouter les images aériennes, on ajoute l'attribution
    // // if (this.layout_choisi.fond_exist && this.layout_choisi.fond) {
    // //   printUrl = printUrl +'&attribution='+encodeURI('© données Google')
    // // }

    printUrl = printUrl +
    '&map0:rotation='+this.layout_choisi.rotation*-1
    // '&map1:rotation='+this.layout_choisi.rotation*-1
    // &map0:rotation=18
   
    // this.openWindowWithPost(printUrl)
    this.http.get(printUrl,{responseType:'blob'}).pipe(
      take(1),
      catchError((error: HttpErrorResponse) => {
        this.notifier.notify(
          "error",
          this.translate.instant("layer.error_print")
        )

        // Cacher le spinner et activer le bouton imprimer
        this.showLoading = () => {
          return false;
        }
        return EMPTY
      }),
      tap((response)=>{
        // It is necessary to create a new blob object with mime-type explicitly set
            // otherwise only Chrome works like it should
            var newBlob = new Blob([response], { type: "application/pdf" });

            // IE doesn't allow using a blob object directly as link href
            // instead it is necessary to use msSaveOrOpenBlob
            // if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            //     window.navigator.msSaveOrOpenBlob(newBlob);
            //     return;
            // }

            // For other browsers: 
            // Create a link pointing to the ObjectURL containing the blob.
            const data = window.URL.createObjectURL(newBlob);

            var link = document.createElement('a');
            link.href = data;
            link.download = this.layout_choisi.titre ? this.layout_choisi.titre : "PLAN AUTO ABM.pdf";
            // this is necessary as link.click() does not work on the latest firefox
            link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

            setTimeout(function () {
                // For Firefox it is necessary to delay revoking the ObjectURL
                window.URL.revokeObjectURL(data);
                link.remove();
            }, 100);

            // Cacher le spinner et activer le bouton imprimer
            this.showLoading = () => {
              return false;
            }
      })
    ).subscribe()
    // this.goToLink(printUrl)
  }

  openWindowWithPost(url:string) {
    // var url = "http://tilespr.undermap.me/cgi-bin/qgis_mapserv.fcgi?SERVICE=WMS&VERSION=1.3.0&map=/var/www/projet_qgis/PSR_MOIRANS/PSR_MOIRANS_web.qgz&REQUEST=GetPrint&FORMAT=pdf&CRS=EPSG:3857&DPI=800&TEMPLATE=default&map0:extent=619559.5835511027,5672152.812406059,619659.5922958585,5672232.680740317&map0:scale=284.4405598435764&map0:LAYERS=RTE_GMR_DAUPHINE_8e27e3af_288f_4cc7_9f8f_46ecf08865b2,ENEDIS_2fb9c5ba_8db0_4798_ad5c_15cc8bdbb88e,COMMUNE_DE_MOIRANS_ELEC_6e569eb1_cf5e_4f2d_8ab5_664d24e2bca9,ORANGE_265da11d_1659_4c13_8d5e_dcdfd3aabcb8,ILIAD_29434dae_c673_4c55_8808_5e94c59c7ed8,ALTICE_SFR_FTTH_30d142bd_d517_4c3b_b294_d6bd3d4d9a43,COMMUNE_DE_MOIRANS_TEL_7ca6d295_e485_4338_8f1f_8817d37a5e09,GRDF_0762a113_6835_4425_aa4d_c53683a3e063,COMMUNE_DE_MOIRANS_b2d23cd2_9a96_4d73_8451_557babe94e5f,COMMUNE_DE_MOIRANS_ASS_77b351c0_3adc_4288_b38d_d80dc79711d3,G19_0434_MOIRANS_PROFIL_CHAUFFAGE_URBAIN_POLYGON_GE_2837640e_8715_4017_bec9_d9d6ca0d3397&map0:STYLES=d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,d%C3%A9faut,gray&nom_format=A3&echelle=1/200&epsg=3857&map0:grid_interval_x=20&map0:grid_interval_y=20&map1:extent=619459.5835511027,5672052.812406059,619759.5922958585,5672332.680740317&map1:LAYERS=G19_0434_MOIRANS_PROFIL_CHAUFFAGE_URBAIN_POLYGON_GE_2837640e_8715_4017_bec9_d9d6ca0d3397&map1:STYLES=gray&titre=&description=&map0:rotation=0"
    var url_node = "http://sigftp.undermap.me/"
    var form = document.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", url_node+"/print");

    form.setAttribute("target", "view");

    var hiddenField = document.createElement("input"); 
    // hiddenField.setAttribute("url", url);
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", "url");
    hiddenField.setAttribute("value", url);

    form.appendChild(hiddenField);
    document.body.appendChild(form);

    window.open('', 'view');

    form.submit();
  }
  goToLink(url: string) {
    window.open(url, "_blank");
  }

  isLandTemplate(nom_template: string) {
    return ['fiabilisation_fonciere', 'mise_a_disposition', 'plan_actions_correctives'].includes(nom_template)
  }
}
