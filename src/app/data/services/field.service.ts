import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { GeoJSONFeatureCollection } from 'ol/format/GeoJSON';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CustomField, FeatureCount, Field
} from '../models/type';
import { RemoveField, SaveFields } from '../models/layer-field';

@Injectable({
  providedIn: 'root',
})
export class FieldService {
  headers: HttpHeaders = new HttpHeaders({});
  url_prefix = environment.backendUrl;
  fieldSaved:EventEmitter<any>=new EventEmitter();

  constructor(private http: HttpClient) {
    this.headers.append('Content-Type', 'application/x-www-form-urlencoded');
    this.headers.append('Content-Type', 'application/json');
  }

  /**
   * Get header
   * @returns HttpHeaders
   */
  get_header(): HttpHeaders {
    this.headers = this.headers.set(
      'Authorization',
      'Bearer  ' + localStorage.getItem('token')
    );
    return this.headers;
  }

  /**
   * get all fields of a vector provider
   * @param typename string
   * @param map string
   * @returns Observable<Fields[]>
   */
  getAllFieldsOfVectorProvider(query: string): Observable<Field[]> {
    return this.http.get<Array<Field>>(
      this.url_prefix + '/api/provider/vector/fields?' + query,
      { headers: this.get_header() }
    );
  }

  /**
   * get custom fields of a vector provider
   * @param typename string
   * @param map string
   * @returns Observable<CustomFields[]>
   */
  getCustomFieldsOfVectorProvider(
    query: string,
  ): Observable<CustomField[]> {
    return this.http.get<Array<CustomField>>(
      this.url_prefix + '/api/provider/field/custom?' + query,
      { headers: this.get_header() }
    );
  }

  /**
   * save the list of customfields
   * @param data list of custom fields
   * @returns Observable<CustomField[]>
   */
  saveCustomFields(data: {
    custom_fields: Array<CustomField>,
    provider_vector_id: number,
  }): Observable<CustomField[]> {
    return this.http.post<Array<CustomField>>(
      this.url_prefix + '/api/provider/field/save-custom',
      data
    );
  }

  /**
   * Get features for attribute tables
   * @param querry WFS query params
   * @returns Observable<GeoJson>
   */
  getFeatures(querry:string): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(
      this.url_prefix + '/api/provider/vector/features?' + querry,
      { headers: this.get_header() }
    );
  }

  /**
   * Get features count
   * @param querry WFS query params
   * @returns  Observable<FeatureCount>
   */
  getFeaturesCount(querry: string): Observable<FeatureCount> {
    return this.http.get<FeatureCount>(
      this.url_prefix + '/api/group/wfs?' + querry,
      { headers: this.get_header() }
    );
  }

    /**
   * Download features
   * @param querry WFS query params
   * @returns  Observable<any>
   */
  downloadFeatures(query: string):  Observable<Blob> {
    return this.http.get(
      this.url_prefix + '/api/group/download-features?' + query,
      { responseType: 'blob' }
    );
  }

  checkIfFieldHasManyValues(data:{project:string,layer:string}):Observable<{field:string,choices:string[]}[]>{
    return this.http.get<{field:string,choices:string[]}[]>(
      this.url_prefix+'/api/provider/field/choices?project='+data.project+"&layer="+data.layer,
      {headers:this.get_header()}
    )
  }

  saveFields(query:string, data:SaveFields){
    return this.http.post<Array<CustomField>>(
      this.url_prefix + '/api/provider/field/add?' + query,
      data
    );
  }

  removeField(query:string, data:RemoveField){
    return this.http.delete<{status:boolean, message:string}>(
      this.url_prefix + '/api/provider/field/remove?' + query,
      {body: data}
    );
  }
}
