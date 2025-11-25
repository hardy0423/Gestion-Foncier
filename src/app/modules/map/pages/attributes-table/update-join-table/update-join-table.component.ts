import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';
import { NotifierService } from 'angular-notifier';
import { catchError, EMPTY, filter, map, merge, Observable, ReplaySubject, shareReplay, Subject, switchMap, take, takeUntil, tap, withLatestFrom } from 'rxjs';
import { DataJoinCount } from 'src/app/data/models/type';
import { MapsService } from 'src/app/data/services/maps.service';
import { UploadFileDataComponent } from '../upload-file-data/upload-file-data.component';

export interface JoinTableInfo {
  displayedColumns: string[],
  dataCount: number
}


@Component({
  selector: 'app-update-join-table',
  templateUrl: './update-join-table.component.html',
  styleUrls: ['./update-join-table.component.scss']
})
export class UpdateJoinTableComponent implements OnInit {

  /**
   * get the list data (join table)
   */
  public onInitInstance: () => void;


  /**
   * Emit to change page
   */
  onPageChangeInstance: (e: PageEvent) => void;

  /**
   * Emit to download
   */
  onDownloadInstance: () => void;

  /**
 * Emit to update the data table
 */
  onUpdateDataInstance: () => void;

  /**
  * data list (change type)
  */
  dataTable$: Observable<any[]>;
  form: FormGroup = this.formBuilder.group({});
  resultsLength = 0;
  loadingTable$: Observable<JoinTableInfo>;

  isLoadingResults: boolean = false;
  isLoadingDownload: boolean = false;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatPaginator) set paginator_(paginator: MatPaginator) {
    if (paginator) {
      paginator.page
        .pipe(
          takeUntil(this.destroyed$),
          tap((e: PageEvent) => {
            this.onPageChangeInstance(e);
          })
        )
        .subscribe();
    }
  }


  constructor(
    public dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    public mapsService: MapsService,
    private formBuilder: FormBuilder,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public dialogRef: MatDialogRef<UpdateJoinTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { layer_id?: number, join_tables?: string },
  ) {

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };


    const onUpdateData: Subject<void> = new Subject<void>();
    this.onUpdateDataInstance = () => {
      onUpdateData.next();
    }

    const onDownload: Subject<void> = new Subject<void>();
    this.onDownloadInstance = () => {
      onDownload.next();
    };


    const onPageChange: Subject<PageEvent> = new Subject<PageEvent>();
    this.onPageChangeInstance = (e: PageEvent) => {
      onPageChange.next(e);
    };

    this.loadingTable$ = merge(onInit).pipe(
      switchMap(() => {
        this.isLoadingResults = true;
        this.cdRef.detectChanges();

        return this.mapsService.getDataJoinCount(this.data.layer_id, this.data.join_tables).pipe(
          catchError((value: HttpErrorResponse)  => {
            if (value.error.msg) {
              this.notifierService.notify("error", value.error.msg)
            }
            else {
              this.notifierService.notify("error", this.translate.instant('map.attribute_tables.error_getting_count_features'))
            }
            this.isLoadingResults = false;
            return EMPTY
          }),
          map((dataCount: DataJoinCount) => {
            let result: JoinTableInfo = {
              displayedColumns: dataCount.columns,
              dataCount: dataCount.count
            }
            this.isLoadingResults = false;
            return result;
          })
        )
      }),
      shareReplay(1)
    )

    this.dataTable$ = merge(
      onUpdateData.pipe(
        switchMap(() => {
          return this.dialog
            .open(UploadFileDataComponent, {
              disableClose: true,
              minWidth: 500,
              data: this.data.join_tables,
            })
            .afterClosed()
            .pipe(
              filter(res => res),
              tap(() => {
                this.notifierService.notify("success", this.translate.instant('map.attribute_tables.update_with_excel_success'))
              })
            );
        })
      ),
      onPageChange, this.loadingTable$).pipe(
        withLatestFrom(this.loadingTable$),
        switchMap(() => {
          this.isLoadingResults = true;
          this.cdRef.detectChanges();
          return this.mapsService.getDataJoinTables(this.data.layer_id, this.data.join_tables, this.paginator.pageSize, this.paginator.pageIndex + 1).pipe(
            catchError((value: HttpErrorResponse) => {
              if (value.error.msg) {
                this.notifierService.notify("error", value.error.msg)
              }
              else {
                this.notifierService.notify("error", this.translate.instant('map.attribute_tables.error_getting_features'))
              }
             this.isLoadingResults = false;
              return EMPTY
            }),
            map((result) => {
              return result;
            })
          )
        }),
        map((result) => {
          this.isLoadingResults = false;
          this.resultsLength = result ? result.length : 0;
          return result;
        }),
        takeUntil(this.destroyed$)
      )

    onDownload.pipe(
      takeUntil(this.destroyed$),
      switchMap(() => {
        this.isLoadingDownload = true;
        this.cdRef.detectChanges()
        return this.mapsService.downloadFeatures(this.data.layer_id, this.data.join_tables).pipe(
          take(1),
          catchError((error: HttpErrorResponse) => {
            this.isLoadingDownload = false;
            this.notifierService.notify("error", error.error?.msg ? error.error.msg : this.translate.instant('map.attribute_tables.error_download_features'))
            return EMPTY
          }),
          tap((response) => {
            let url = window.URL.createObjectURL(response);
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.setAttribute('style', 'display: none');
            a.href = url;
            a.download = this.data.join_tables + '.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            this.isLoadingDownload = false;
          })
        )
      })
    ).subscribe()

  }

  closeDialog(): void {
    this.dialogRef.close()
  }

  ngOnInit(): void {
    this.onInitInstance();
  }
  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

}
