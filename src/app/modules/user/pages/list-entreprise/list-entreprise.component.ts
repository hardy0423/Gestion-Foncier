import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSort, Sort } from "@angular/material/sort";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  filter,
  map,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { Entreprise } from "src/app/data/models/account";
import { EntrepriseService } from "src/app/data/services/entreprise.service";
import { StoreService } from "src/app/data/store/store.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { AddEntrepriseComponent } from "../add-entreprise/add-entreprise.component";
@Component({
  selector: "app-list-entreprise",
  templateUrl: "./list-entreprise.component.html",
  styleUrls: ["./list-entreprise.component.scss"],
})
export class ListEntrepriseComponent implements OnInit {
  /**
   * get the list entreprise
   */
  public onInitInstance: () => void;

  /**
   * Emit to sort name entreprise column
   */
  onSortChangeInstance: (e: Sort) => void;

  /**
   * Emit to add one entreprise
   */
  public onAddEntrepriseInstance: () => void;

  /**
   * Emit to edit one entreprise
   */
  public onEditEntrepriseInstance: (entreprise: Entreprise) => void;

  /**
   * entreprise list of a map
   */
  entreprises$: Observable<Entreprise[]>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  displayedColumns: string[] = ["name"];

  loading: boolean = true;

  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      sort.sortChange
        .pipe(
          takeUntil(this.destroyed$),
          tap((e: Sort) => {
            this.onSortChangeInstance(e);
          })
        )
        .subscribe();
    }
  }

  constructor(
    public manageCompHelper: ManageCompHelper,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public entrepriseService: EntrepriseService,
    public route: ActivatedRoute,
    public router: Router,
    public dialog: MatDialog,
    public store: StoreService
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAddEntreprise: Subject<void> = new Subject<void>();
    this.onAddEntrepriseInstance = () => {
      onAddEntreprise.next();
    };

    const onEditEntreprise: Subject<Entreprise> = new Subject<Entreprise>();
    this.onEditEntrepriseInstance = (entreprise: Entreprise) => {
      onEditEntreprise.next(entreprise);
    };

    const onSortChange: Subject<Sort> = new Subject<Sort>();
    this.onSortChangeInstance = (e: Sort) => {
      onSortChange.next(e);
    };

    this.entreprises$ = merge(
      onSortChange,
      onAddEntreprise.pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddEntrepriseComponent, {
              data: null,
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
              width: "25vw",
              maxHeight: "100vh",
              height: "100vh",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              })
            );
        })
      ),

      onEditEntreprise.pipe(
        filter((entreprise) => entreprise != undefined),
        switchMap((entreprise) => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddEntrepriseComponent, {
              data: entreprise,
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
              width: "25vw",
              maxHeight: "100vh",
              height: "100vh",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              })
            );
        })
      ),
      onInit
    ).pipe(
      map((parameters: void | Sort) => {
        if (parameters != undefined) {
          return parameters;
        }
        let sort: Sort = {
          active: "created_at",
          direction: "desc",
        };
        return sort;
      }),
      switchMap((sort: Sort) => {
        this.loading = true;
        let ordering = sort.direction == "asc" ? "" : "-";
        return this.entrepriseService
          .getAllEntreprises("ordering=" + ordering + sort.active)
          .pipe(
            tap((enterprises) => {
              this.loading = false;
              this.store.enterprises$.next(enterprises)
            }),
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("entreprises.error_loading_entreprises")
              );
              this.loading = false;
              return EMPTY;
            })
          );
      })
    );
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  redirectUser() {
    this.router.navigate(["/user/users"]);
  }
}
