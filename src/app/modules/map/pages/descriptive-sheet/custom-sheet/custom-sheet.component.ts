import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { Map } from 'maplibre-gl';
import { Subject } from 'rxjs';
import { FeatureProperties } from 'src/app/data/models/type';
import { GeoDataService } from 'src/app/data/services/geo-data.service';
import { environment } from 'src/environments/environment';
import { FeatureForSheet } from '../descriptive-sheet.component';
@Component({
  selector: 'app-custom-sheet',
  templateUrl: './custom-sheet.component.html',
  styleUrls: ['./custom-sheet.component.scss'],
})
export class CustomSheetComponent implements OnInit {
  public onInitInstance: () => void
  /**
   * List of features from WMSGetFeatureInfo at pixel where user clicked
   */
  @Input() feature: FeatureForSheet;
  @Input() map: Map;
  @Input() fields: Array<FeatureProperties> = [];


  tabsFields: {
    onglet: string,
    fields: FeatureProperties[]
  }[] = []


  environment = environment;

  constructor(
    private cdRef: ChangeDetectorRef,
    public geoDataService: GeoDataService) {
    const onInit: Subject<void> = new Subject<void>()
    this.onInitInstance = () => {
      onInit.next()
    }
  }


  /**
   * on init
   */
  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    //Called before any other lifecycle hook. Use it to inject dependencies, but avoid any serious work here.
    //Add '${implements OnChanges}' to the class.
    if (changes["fields"]) {
      if (this.fields) {
        this.tabsFields = Array.from(
          new Set(this.fields.map((item: any) => item.onglet))
        ).map((onglet: string) => {
          return {
            onglet: onglet,
            fields: this.fields.filter((field) => field.onglet == onglet),
          }
        })
      }
    }
  }


  /**
   * Ckeck if fields value is an url
   */
  isValidUrl(link: string) {
    let url;
		try { 
        url =new URL(link); 
    }
    catch(e){ 
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }


  /**
   * Download file
   */
  downloadFile(value) {
    const name = value.lastIndexOf('/');
    const filename = value.substring(name + 1);
    let link = document.createElement('a');
    link.href = value;
    link.target = '_target';
    link.download = filename;
    link.click();
  }

  getNameFile(value) {
    const name = value.lastIndexOf('/');
    return value.substring(name + 1);
  }


  /**
   * detect and replace http or https links on button
   * @param text string
   * @returns 
   */
  detectAndReplaceHttpsLinks(value: string | number | null): string {
    if (typeof value === 'string') {
      const pattern = /(https?:\/\/\S+)/gi;
      return value.replace(pattern, (match) => {
        return `<a href="${match}" target="_blank">${match}</a>`;
      });
    } else {
      return `<span>${value}</span>`;
    }
  }

}
