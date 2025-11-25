import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as $ from 'jquery';
import { Type } from 'ol/geom/Geometry';
// import { Map } from 'src/app/ol-module';
// import { Polygon } from 'ol/geom.js';
// import LineString from 'ol/geom/LineString';
// import Draw from 'ol/interaction/Draw.js';
// import { Vector as VectorLayer } from 'ol/layer.js';
// import { unByKey } from 'ol/Observable.js';
// import Overlay from 'ol/Overlay.js';
// import VectorSource from 'ol/source/Vector.js';
// import { getArea, getLength } from 'ol/sphere.js';
// import { Circle as CircleStyle, Fill, Stroke } from 'ol/style.js';
// import Style from 'ol/style/Style';
import { 
  // GeometryType,
  //  OverlayPositioning, 
   Map, 
   Polygon, 
   LineString, 
   Draw, 
   VectorLayer, 
   unByKey, 
   Overlay, 
   VectorSource, 
   getArea, 
   getLength,
   CircleStyle,
   Fill,
   Stroke,
   Style 
  } from 'src/app/ol-module';
import { environment } from 'src/environments/environment';
import { speedDialFabAnimations } from './mesure.animations';
// https://medium.com/@aphlps/fab-speed-dial-with-angular-5-2-angular-material-be696fc14967
@Component({
  selector: 'app-mesure-digitaliser',
  templateUrl: './mesure.component.html',
  styleUrls: ['./mesure.component.scss'],
  animations: speedDialFabAnimations
})
export class MesureComponent implements OnInit {

  constructor(
    public translate:TranslateService
  ) { 
    
    this.translate.get('map.tools', {value: 'continuePolygonMsg'}).subscribe((res) => {
      this.continuePolygonMsg = res['continuePolygonMsg']
      this.continueLineMsg = res['continueLineMsg']
    });

  }
  buttonDisposition:'column'|'row'='row'

  typeMesures = [
    {
      type: 'distance'
    },
    {
      type: 'surface'
    },
  ];

  buttons = [];
  fabTogglerState = 'inactive';

  showItems() {
    this.fabTogglerState = 'active';
    this.buttons = this.typeMesures;
  }

  hideItems() {
    this.fabTogglerState = 'inactive';
    this.buttons = [];
  }

  onToggleFab() {
    if (this.status_mesure.area) {
      this.mesure('area')
    }else if (this.status_mesure.length){
      this.mesure('length')
    }
    this.buttons.length ? this.hideItems() : this.showItems();
  }


  map : Map
  vector_dessin
  source_dessin

  /**
 * Currently drawn feature.
 * @type {module:ol/Feature~Feature}
 */
  sketch;
  pointermove_event
  a :String

  /**
   * The help tooltip element.
   * @type {Element}
   */
  helpTooltipElement;


  /**
   * Overlay to show the help messages.
   * @type {module:ol/Overlay}
   */
  helpTooltip;


  /**
   * The measure tooltip element.
   * @type {Element}
   */
  measureTooltipElement;


  /**
   * Overlay to show the measurement.
   * @type {module:ol/Overlay}
   */
  measureTooltip;


  /**
   * Message to show when the user is drawing a polygon.
   * @type {string}
   */
  continuePolygonMsg ;

 
  /**
   * Message to show when the user is drawing a line.
   * @type {string}
   */
  continueLineMsg ;


  status_mesure={
    'length':false,
    'area':false,
  }

  typeSelect:'length'|'area';

  draw; // global so we can remove it later


  mesure(type:'length'|'area') {
    if (this.status_mesure[type]) {
      this.stop_mesure(type)
    } else {
      this.start_mesure(type)
    }
  }

  formatLength(line) {
    var length = getLength(line);
    var output;
    if (length > 100) {
      output = (Math.round(length / 1000 * 100) / 100) +
        ' ' + 'km';
    } else {
      output = (Math.round(length * 100) / 100) +
        ' ' + 'm';
    }
    return output;
  };

  formatArea(polygon) {
    var area = getArea(polygon);
    var output;
    if (area > 10000) {
      output = (Math.round(area / 1000000 * 100) / 100) +
        ' ' + 'km<sup>2</sup>';
    } else {
      output = (Math.round(area * 100) / 100) +
        ' ' + 'm<sup>2</sup>';
    }
    return output;
  };

  addInteraction() {
    var type = (this.typeSelect == 'area' ? 'Polygon' : 'LineString');
    this.draw = new Draw({
      source: this.source_dessin,
      type: type as Type,
      condition:function(e) {
        if (e.originalEvent['buttons'] === 2) {
          return false;
        } else{
          return true
        }
      },
      style: new Style({
        fill: new Fill({
          color: environment.primaryColorTransparentRgba
        }),
        stroke: new Stroke({
          color: environment.primaryColor,
          lineDash: [10, 10],
          width: 2
        }),
        image: new CircleStyle({
          radius: 5,
          stroke: new Stroke({
            color: environment.primaryColor
          }),
          fill: new Fill({
            color: environment.primaryColorTransparentRgba
          })
        })
      })
    })

    this.map.addInteraction(this.draw);

    this.createMeasureTooltip();
    this.createHelpTooltip();

    var listener;
    this.draw.on('drawstart',
       (evt) =>{
        // set sketch
        this.sketch = evt.feature;

        /** @type {module:ol/coordinate~Coordinate|undefined} */
        var tooltipCoord = evt.coordinate;

        listener = this.sketch.getGeometry().on('change', (evt)=> {
          var geom = evt.target;
          var output;
          if (geom instanceof Polygon) {
            output = this.formatArea(geom);
            tooltipCoord = geom.getInteriorPoint().getCoordinates();
          } else if (geom instanceof LineString) {
            output = this.formatLength(geom);
            tooltipCoord = geom.getLastCoordinate();
          }
          this.measureTooltipElement.innerHTML = output;
          this.measureTooltip.setPosition(tooltipCoord);
        });
      });

      this.draw.on('drawend',() =>{
        this.measureTooltipElement.className = 'tooltip tooltip-static';
        this.measureTooltip.setOffset([0, -7]);
        // unset sketch
        this.sketch = null;
        // unset tooltip so that a new one can be created
        this.measureTooltipElement = null;
        this.createMeasureTooltip();
        unByKey(listener);
      });
  }

  createHelpTooltip() {
    if (this.helpTooltipElement) {
      this.helpTooltipElement.parentNode.removeChild(this.helpTooltipElement);
    }
    this.helpTooltipElement = document.createElement('div');
    this.helpTooltipElement.className = 'tooltiphelp hidden';
    this.helpTooltip = new Overlay({
      element: this.helpTooltipElement,
      offset: [15, 0],
      positioning: 'center-left'
    });
    this.map.addOverlay(this.helpTooltip);
  }

  createMeasureTooltip() {
    if (this.measureTooltipElement) {
      this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
    }
    this.measureTooltipElement = document.createElement('div');
    this.measureTooltipElement.className = 'tooltip tooltip-measure';
    this.measureTooltip = new Overlay({
      element: this.measureTooltipElement,
      offset: [0, -15],
      positioning: 'bottom-center'
    });
    this.map.addOverlay(this.measureTooltip);
  }

  pointerMoveHandler(evt) {
    if (evt.dragging) {
      return;
    }
    /** @type {string} */
    var helpMsg = 'Cliquez pour commencer à mesurer';

    if (this.sketch) {
      var geom = (this.sketch.getGeometry());
      if (geom instanceof Polygon) {
        helpMsg = this.continuePolygonMsg;
      } else if (geom instanceof LineString) {
        helpMsg = this.continueLineMsg;
      }
    }

    this.helpTooltipElement.innerHTML = helpMsg;
    this.helpTooltip.setPosition(evt.coordinate);

    this.helpTooltipElement.classList.remove('hidden');
  }
  ngOnInit() {

    

  }

  setMapInstance(map){
    this.map = map

    this.map.getViewport().addEventListener('contextmenu',  (evt)=> {
      evt.preventDefault();
      if (this.draw) {
        this.draw.finishDrawing();
      }
    })

    // var keydown = function(evt){
    //   var charCode = (evt.which) ? evt.which : evt.keyCode;
    //   if (charCode === 27 && drawing === true){ //esc key
    //       //dispatch event
    //       this.stop_mesure()
    //       draw.set('escKey', Math.random());
    //   }
    // };
  
    document.addEventListener('keydown', (evt)=>{
      var charCode = (evt.which) ? evt.which : evt.keyCode;
        if (charCode === 27 && this.draw){ 
          this.stopAllMesure()
        }
    }, false);

  }

  initialise_mesure(){
    this.source_dessin = new VectorSource();

    this.vector_dessin = new VectorLayer({
      source: this.source_dessin,
      style: new Style({
        fill: new Fill({
          color: environment.primaryColorTransparentRgba
        }),
        stroke: new Stroke({
          color: environment.primaryColor,
          width: 2
        }),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({
            color: environment.primaryColor
          })
        })
      })
    });

    this.vector_dessin.setZIndex(99)
    this.map.addLayer(this.vector_dessin)
    

  }
  
  start_mesure(type){
    this.map.removeInteraction(this.draw);
    this.typeSelect = type
    this.addInteraction();

    this.pointermove_event = this.map.on('pointermove', (evt) => {
      this.pointerMoveHandler(evt)
    });

    this.map.getViewport().addEventListener('mouseout', () => {
      this.helpTooltipElement.classList.add('hidden');
    });

    this.status_mesure.length = false
    this.status_mesure.area = false

    this.status_mesure[type] = true
  }

  stop_mesure(type){
    this.stopAllMesure()
    this.status_mesure[type] = false
  }

  stopAllMesure(){
    this.map.removeInteraction(this.draw);
    
    // $('.ol-overlay-container.ol-selectable').remove()

    // $('.ol-overlay-container.ol-selectable').remove(".tooltip")
    this.helpTooltipElement.classList.add('hidden');
    
    this.map.removeOverlay(this.helpTooltip)
    this.map.removeOverlay(this.measureTooltip)
    this.map.getViewport().removeEventListener('mouseout', () => {
      this.helpTooltipElement.classList.add('hidden');
    });
    unByKey(this.pointermove_event)
    // this.measureTooltipElement.parentNode.removeChild(this.measureTooltipElement);
    this.source_dessin.clear()
    $('.tooltip.tooltip-static').remove()
    this.status_mesure.length = false
    this.status_mesure.area = false
  }
}
