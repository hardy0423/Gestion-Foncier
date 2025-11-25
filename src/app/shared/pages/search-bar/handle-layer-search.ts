import { Layer } from 'src/app/data/models/type';
import { environment } from 'src/environments/environment';
import { AppInjector } from 'src/helper/app-injector.helper';
import { ManageCompHelper } from 'src/helper/manage-comp.helper';
import { filterOptionInterface } from './search-bar.component';
import { Map } from 'maplibre-gl';
import { EMPTY } from 'rxjs';
import { catchError, take, tap } from 'rxjs/operators';
import { GeoDataService } from 'src/app/data/services/geo-data.service';
import { MapsService } from 'src/app/data/services/maps.service';

/**
 * class for handle couche thematique   search:
 * - format data from server to display list od response
 * - format response when user select an option
 */
export class handleLayerSearch {

  manageCompHelper: ManageCompHelper = AppInjector.get(ManageCompHelper);
  mapsService: MapsService = AppInjector.get(MapsService);
  geoData: GeoDataService = AppInjector.get(GeoDataService);

  constructor() {
  }

  /**
   * format response from server into a list to display on ui
   * @param responseDB any
   */
  formatDataForTheList(responseDB: Layer[]): Array<filterOptionInterface> {
    var response: Array<filterOptionInterface> =
      responseDB
        .filter((layer) => layer.providers.filter((pr) => pr.vp.state === 'good').length > 0)
        .map((layer) => {
          return {
            name: layer.name,
            layer: layer,
            number: layer.providers.map((pr) => pr.vp.count).reduce((a, b) => a + b, 0),
            id: layer.layer_id,
            icon: environment.backendUrl + layer.cercle_icon,
            typeOption: 'layer'
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
      })
    ).subscribe()

  }

}
