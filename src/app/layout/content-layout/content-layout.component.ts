import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { ReplaySubject, Subscription } from "rxjs";
import { User } from "src/app/data/models/account";
import { AuthService } from "src/app/core/service/auth.service";
import { StoreService } from "src/app/data/store/store.service";
import { TranslateService } from "@ngx-translate/core";
import { MatSelectionListChange } from "@angular/material/list";
import { ParametersService } from "src/app/data/services/parameters.service";
import { FullscreenService } from "src/app/data/services/fullscreen.service";

@Component({
  selector: "app-content-layout",
  templateUrl: "./content-layout.component.html",
  styleUrls: ["./content-layout.component.scss"],
})
export class ContentLayoutComponent implements OnInit {
  user: User;
  current_selected: number = 1;
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  isFullscreen = false;
  private fullscreenSubscription: Subscription;
  
  initialSidebarStatus: Boolean = true;

  constructor(
    public router: Router,
    public authService: AuthService,
    public translate: TranslateService,
    public store: StoreService,
    public parametersService: ParametersService,
    private fullscreenService: FullscreenService
  ) {
    this.user = this.store.user;
  }

  ngOnInit(): void {
    if (this.router.url.includes("map")) {
      this.current_selected = 1;
    } else if (this.router.url.includes("layer")) {
      this.current_selected = 2;
    } else if (this.router.url.includes("land")) {
      this.current_selected = 3;
    } else if (this.router.url.includes("user/users")) {
      this.current_selected = 4;
    }
    this.fullscreenSubscription = this.fullscreenService.fullscreen$.subscribe(isFullscreen => {
      this.isFullscreen = isFullscreen;
      let planeClasses = document.getElementsByClassName(
        "left-panel"
      ) as HTMLCollectionOf<HTMLElement>;
      if (isFullscreen) {
        this.initialSidebarStatus = this.parametersService.sideBar ? this.parametersService.sideBar.opened : true;
        this.parametersService.sideBar ? this.parametersService.sideBar.close() : '';
        planeClasses[0].style.width = "0";
        let carte = document.getElementsByClassName('maplibregl-canvas')  as HTMLCollectionOf<HTMLElement>;
        if (carte.length > 0) {
          carte[0].style.width = '100%'
        }        
      } else {
        if (this.parametersService.sideBar) {
          this.initialSidebarStatus ? this.parametersService.sideBar.open() : this.parametersService.sideBar.close();
        };
      }    
    });
  }

  /**
   * log out
   */
  logOut() {
    this.authService.logOut();
  }

  /**
   * on select an option
   * @param e
   */
  onSelection(e:MatSelectionListChange) {
    this.current_selected = e.options[0].value;
    switch (this.current_selected) {
      case 1:
        this.router.navigate(["map"]);
        break;
      case 2:
        this.router.navigate(["layers"]);
        break;
      case 3:
        this.router.navigate(["land"]);
        break;
      case 4:
        this.router.navigate(["user", "users"]);
        break;
    }
  }

  ngOnDestroy() {
    if (this.fullscreenSubscription) {
      this.fullscreenSubscription.unsubscribe();
    }
  }
}
