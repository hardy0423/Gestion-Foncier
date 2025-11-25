import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NotifierService } from 'angular-notifier';
import { catchError, EMPTY, map, ReplaySubject, switchMap, takeUntil, tap } from 'rxjs';
import { Layer } from 'src/app/data/models/type';
import { MapsService } from 'src/app/data/services/maps.service';
import { StoreService } from 'src/app/data/store/store.service';
import { LayerDetailsComponent } from '../layer-details/layer-details.component';

@Component({
  selector: 'app-layer-details-layout',
  templateUrl: './layer-details-layout.component.html',
  styleUrls: ['./layer-details-layout.component.scss']
})
export class LayerDetailsLayoutComponent implements OnInit {

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  private readonly notifier: NotifierService;
  constructor(
    private route: ActivatedRoute,
    public Router: Router,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public mapService: MapsService,
    public dialog: MatDialog,
    public store: StoreService
  ) {
    this.notifier = notifierService;
    this.route.paramMap.pipe(
      takeUntil(this.destroyed$),
      map((params: ParamMap) => {
        if (params.get('group_id') == undefined || params.get('layer_id') == undefined) {
          this.Router.navigate(['layers'])
        }
        return [params.get('group_id'), params.get('layer_id')]
      }),
      switchMap((params) => {
        let group_id = Number(params[0])
        let layer_id = Number(params[1])
        this.store.expandedGroupId$.next(group_id)
        this.store.openedLayerId$.next(layer_id)
        return this.mapService.getLayer(layer_id).pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              this.translate.instant('layer.error_loading_layer')
            );
            this.Router.navigate(['layers'])
            return EMPTY;
          }),
          switchMap((layer: Layer) => {
            return this.dialog
              .open(LayerDetailsComponent, {
                data: layer,
                panelClass: [
                  "dialogWithNoPadding",
                  "animate__animated",
                  "animate__slideInRight",
                ],
                position: {
                  top: "0px",
                  bottom: "0px",
                  right: "0px",
                },
                width: "50%",
                maxHeight: "100%",
                height: "100%",
              })
              .afterClosed().pipe(
                tap((value) => {
                  if (value) {

                    this.Router.navigate(['layers'],
                      {
                        queryParams: {
                          reload: true
                        }
                      })
                  }
                  else {
                    this.Router.navigate(['layers'])
                  }
                  this.store.openedLayerId$.next(null)
                })
              )
          })
        )
      })
    ).subscribe()
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

}
