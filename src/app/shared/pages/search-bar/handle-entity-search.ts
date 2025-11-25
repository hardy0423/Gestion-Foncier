import { Layer, responseOfSerachEntityInterface } from 'src/app/data/models/type';
import { environment } from 'src/environments/environment';
import { AppInjector } from 'src/helper/app-injector.helper';
import { ManageCompHelper } from 'src/helper/manage-comp.helper';
import { filterOptionInterface } from './search-bar.component';
import { Map } from 'maplibre-gl';
import { MapsService } from 'src/app/data/services/maps.service';
import { SearchLayerService } from 'src/app/data/services/search-layer.service';
import { GeoDataService } from 'src/app/data/services/geo-data.service';
import { take, catchError, EMPTY, tap, switchMap } from 'rxjs';
import { DescriptiveSheetComponent, DescriptiveSheetData } from 'src/app/modules/map/pages/descriptive-sheet/descriptive-sheet.component';
import { CartoHelper, CatalogueLayer } from 'src/app/data/utils/cartoHelper';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
/**
 * class for handle entity  search:
 * - format data from server to display list od response
 * - format response when user select an option
 */
export class handleEntitySearch {

  manageCompHelper: ManageCompHelper = AppInjector.get(ManageCompHelper);
  // dataOsmLayersServiceService: DataOsmLayersServiceService = AppInjector.get(DataOsmLayersServiceService);
  mapsService: MapsService = AppInjector.get(MapsService);
  searchLayerService: SearchLayerService = AppInjector.get(SearchLayerService);
  geoData: GeoDataService = AppInjector.get(GeoDataService);
  dialog: MatDialog = AppInjector.get(MatDialog);
  constructor() {
  }

  /**
   * format response from server into a list to display on ui
   * @param responseDB any
   */
  formatDataForTheList(responseDB: responseOfSerachEntityInterface[]): Array<filterOptionInterface> {
    var response: Array<filterOptionInterface> =
      responseDB
        .map((res) => {
          return {
            name: res.display,
            layer: res.layer,
            feature_id: res.feature_id,
            coordinates_3857: res.coordinates_3857,
            provider_vector_id: res.provider_vector_id,
            id: res.feature_id,
            icon: environment.backendUrl + res.layer.cercle_icon,
            typeOption: 'entity'
          }
        })
    return response
  }

  /**
 * Use to format text that will appear after an option is choose in the autocomplete use to select layers in the UI
 * @param data filterOptionInterface
 * @return string
 */
  displayWith(data: filterOptionInterface): string {
    return ''
  }

  /**
   *  call when an option is select by the user
   * @param data searchLayerToDownlodModelInterface
   */
  optionSelected(data: filterOptionInterface, map: Map) {
    let layer: Layer = data.layer
    this.mapsService.getGroup(layer.group).pipe(
      take(1),
      catchError(() => {
        return EMPTY
      }),
      tap((group) => {
        try {
          this.geoData.addLayer(layer, map, group)
        }
        catch (error){
          
        }
        let cartoHelper = new CartoHelper(map)

       
        setTimeout( () => {

          let bbox_3857 = cartoHelper.getBBoxFormCoordinates(data.coordinates_3857)
          var source = layer.providers.map((pr)=>pr.vp.source)
          let couche = cartoHelper.getLayerByPropertiesCatalogue({couche_id:layer.layer_id,type:'couche'})[0].metadata as CatalogueLayer
          let sheetData: DescriptiveSheetData = {
            type: source[0]==='osm'?'osm':'custom',
            coordinates_3857: data.coordinates_3857,
            bbox_3857: bbox_3857,
            layer_id: layer.layer_id,
            map: map,
            couche:couche
            // feature: result.data.feature[0],
            // layer: layer
          }
          /**
          * close all modal of type DescriptiveSheetComponent before open another
          */
          let position = {
            top: '60px',
            left: window.innerWidth < 500 ? '0px' : (window.innerWidth / 2 - 400 / 2) + 'px'
          }
          for (let index = 0; index < this.dialog.openDialogs.length; index++) {
            const elementDialog = this.dialog.openDialogs[index];
  
            if (elementDialog.componentInstance instanceof DescriptiveSheetComponent 
              && document.getElementById(elementDialog.id) 
              && document.getElementById(elementDialog.id).parentElement
              ) {
              position.top = document.getElementById(elementDialog.id).parentElement.getBoundingClientRect().top + 'px'
              position.left = document.getElementById(elementDialog.id).parentElement.getBoundingClientRect().left + 'px'
              elementDialog.close()
            }
          }
  
          let proprietes: MatDialogConfig = {
            disableClose: false,
            minWidth: 500,
            maxHeight: 460,
            width: '500px',
            data: [sheetData],
            hasBackdrop: false,
            autoFocus: false,
            position: position
          }
         this.dialog.open(DescriptiveSheetComponent, proprietes)

        }, 1000);

      
       
      })
    ).subscribe()

  }

}
