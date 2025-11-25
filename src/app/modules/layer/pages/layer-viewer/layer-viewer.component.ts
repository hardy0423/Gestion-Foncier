import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { NotifierService } from 'angular-notifier';
import { ImageSource, LngLatBounds, Map, MapEvent, MapEventType, MapLayerEventType } from 'maplibre-gl';
import { BehaviorSubject, combineLatest, filter, forkJoin, merge, Observable, ReplaySubject, skip, startWith, Subject, Subscriber, takeUntil, tap, withLatestFrom } from 'rxjs';
import { CategoryStyle, DataForPreview, Layer } from 'src/app/data/models/type';
import { getExtentCoordinatesFromBounds, wmsExtent130FromBounds } from 'src/app/data/utils/cartoHelper';
import { MapLibreEvent } from 'src/app/data/utils/maplibreEvent';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-layer-viewer',
  templateUrl: './layer-viewer.component.html',
  styleUrls: ['./layer-viewer.component.scss']
})
export class LayerViewerComponent implements OnInit {

  private readonly notifier: NotifierService;
  /** The map */
  map: Map;
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);



  /** Check if the loading is showed */
  showLoading: boolean = true;

  @Input() layersForPreview: Layer

  optionsSelected$:BehaviorSubject<Array<CategoryStyle>> = new BehaviorSubject([])

  setOptionsSelected(categories){
    this.optionsSelected$.next(categories as Array<CategoryStyle>)
  }

  /** the map container */
  @ViewChild("previewMapContainer") set mapContainer(mapContainer: ElementRef) {
    this.map = new Map({
      container: mapContainer.nativeElement,
      style: environment.maptilerStyle + environment.maptilerKey,
      center: [7.52047, 47.60025],
      zoom: 13.64,
      attributionControl: false,
      trackResize: true,
      transformRequest: (url, resourceType) => {
        if(url.startsWith(environment.backendUrl)) {
          return {
            url: url,
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem("token") }
          }
        }
        return null
      }
    })

    let mapLibreEvent = new MapLibreEvent()

    merge(mapLibreEvent.fromMapLibreEvent(this.map, 'load'),mapLibreEvent.fromMapLibreEvent(this.map, 'moveend'),combineLatest(this.optionsSelected$,mapLibreEvent.fromMapLibreEvent(this.map, 'load') ) ).pipe(
      filter(()=>this.layersForPreview.providers.length > 0 && this.layersForPreview.providers[0].vp &&  this.layersForPreview.providers[0].vp.id_server && this.layersForPreview.providers[0].vs != undefined ),
      tap((e) => {
        this.addWms(this.optionsSelected$.value)
      }),
      takeUntil(this.destroyed$)
    )
    .subscribe()


    merge(mapLibreEvent.fromMapLibreEvent(this.map, 'movestart'), mapLibreEvent.fromMapLibreEvent(this.map, 'zoomstart')).pipe(
      tap((e) => {
        this.showLoading = true;
      }),
      takeUntil(this.destroyed$)
    ).subscribe()

    mapLibreEvent.fromMapLibreEvent(this.map, 'idle').pipe(
      tap((e) => {
        this.showLoading = false;
      }),
      takeUntil(this.destroyed$)
    ).subscribe()


  }
  constructor(
    notifierService: NotifierService,
  ) {
    this.notifier = notifierService;

  }

  /**
  * Add WMS layer to map
  */
  addWms( categoryStyles:CategoryStyle[]) {
    
    var mapCanvas = this.map.getCanvas();
    var mapBounds = this.map.getBounds();
    var imageCoordinates = getExtentCoordinatesFromBounds(mapBounds);
    var imageExtent3857 = wmsExtent130FromBounds(mapBounds);
   
    let sourceName = this.layersForPreview.providers[0].vp.id_server + '-source'
    let wmsLayerName = this.layersForPreview.providers[0].vp.id_server + '-layer'
    
    let wmsWidth = Math.floor(mapCanvas.width / window.devicePixelRatio)
    let wmsHeight = Math.floor(mapCanvas.height / window.devicePixelRatio)
    let urlWms = this.layersForPreview.providers[0].vp.url_server + '&FORMAT=image/png&SERVICE=WMS&VERSION=1.3.0&FORMAT_OPTIONS=dpi:180' +
      '&REQUEST=GetMap&CRS=EPSG:3857&TRANSPARENT=true&WIDTH=' + wmsWidth + '&HEIGHT=' + wmsHeight + '&LAYERS=' +
      this.layersForPreview.providers[0].vp.id_server + '&TILED=true&STYLE=' + this.layersForPreview.providers[0].vs.name + '&BBOX=' + imageExtent3857.join(',')
    
    if(categoryStyles.length>0){
      let category_id = categoryStyles.map((option)=>option.id)
      urlWms=urlWms+"&category_id="+category_id+"&provider_style_id="+this.layersForPreview.providers[0].vs_id
      // let filter:string = categoryStyles.map((option)=> '"'+option.PropertyName+'" '+option.operator+" '"+option.Literal+"'" ).join(' or ')
      // urlWms=urlWms+"&FILTER="+this.layersForPreview.providers[0].vp.id_server+":"+filter
    }

    if (this.map.getSource(sourceName) && this.map.getLayer(wmsLayerName)) {
      let source = this.map.getSource(sourceName)
      if (source instanceof ImageSource){
        source.updateImage({
          url:urlWms,
          coordinates: imageCoordinates  as any
        })
      }
    }else{
      this.map.addSource(
        sourceName, {
        'type': 'image',
        'url': urlWms,
        'coordinates': imageCoordinates as any
      }
      )
  
      this.map.addLayer(
        {
          'id': wmsLayerName,
          'type': 'raster',
          'source': sourceName,
          'paint': {
            'raster-fade-duration':0
          }
        }
      )
    }
   
  }



  ngOnInit(): void {
  }


  /**
   * on destroy
   */
  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }


}
