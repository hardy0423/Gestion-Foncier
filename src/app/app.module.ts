import { HttpClient, HttpClientModule } from "@angular/common/http";
import { Injector, LOCALE_ID, NgModule } from "@angular/core";
import { CoreModule } from "./core/core.module";
import { BrowserModule } from "@angular/platform-browser";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ContentLayoutComponent } from "./layout/content-layout/content-layout.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AuthLayoutComponent } from "./layout/auth-layout/auth-layout.component";
import { SharedModule } from "./shared/shared.module";
import { setAppInjector } from "src/helper/app-injector.helper";
import { MAT_DATE_LOCALE } from "@angular/material/core";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { DatePipe, registerLocaleData } from "@angular/common";
import localeFr from '@angular/common/locales/fr';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}
const dutchRangeLabel = (page: number, pageSize: number, length: number) => {
  if (length == 0 || pageSize == 0) { return `0 sur ${length}`; }
  
  length = Math.max(length, 0);

  const startIndex = page * pageSize;

  // If the start index exceeds the list length, do not try and fix the end index to the end.
  const endIndex = startIndex < length ?
      Math.min(startIndex + pageSize, length) :
      startIndex + pageSize;

  return `${startIndex + 1} - ${endIndex} sur ${length}`;
}

export function getFrPaginatorIntl() {
  const paginatorIntl = new MatPaginatorIntl();
  
  paginatorIntl.itemsPerPageLabel = 'Elements par page:';
  paginatorIntl.nextPageLabel = 'Prochaine page';
  paginatorIntl.previousPageLabel = 'Précédente page';
  paginatorIntl.getRangeLabel = dutchRangeLabel;
  
  return paginatorIntl;
}
@NgModule({
  declarations: [AppComponent, ContentLayoutComponent, AuthLayoutComponent],
  imports: [
    BrowserModule,
    CoreModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    SharedModule,
    HttpClientModule,
    TranslateModule.forRoot({
      defaultLanguage: "fr",
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }),
  ],
  providers:[{provide: MatPaginatorIntl, useValue: getFrPaginatorIntl() }, { provide: LOCALE_ID, useValue: 'fr' }, DatePipe],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(injector: Injector) {
    setAppInjector(injector);
    registerLocaleData(localeFr);
  }
}

