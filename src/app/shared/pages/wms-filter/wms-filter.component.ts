import { Component, OnInit, Input, EventEmitter, ViewChild, Output , AfterContentChecked, ChangeDetectorRef} from '@angular/core';
import { Style, Layer, CategoryStyle, LayerProviders } from 'src/app/data/models/type';
import { MatSelectionList } from "@angular/material/list";
import { filter, map, takeUntil, tap } from 'rxjs/operators';
import { Observable, ReplaySubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-wms-filter',
  templateUrl: './wms-filter.component.html',
  styleUrls: ['./wms-filter.component.scss']
})
export class WmsFilterComponent implements OnInit {

  @Input() layer:LayerProviders
  @Input() selectedCategories: Array<CategoryStyle> = []
  /**
   * Listen to options selected
   */
  @Output() optionsSelected$:EventEmitter<Array<CategoryStyle>> = new EventEmitter<Array<CategoryStyle>>()

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  
  @ViewChild(MatSelectionList) set expressionsList(
    expressionsList: MatSelectionList
  ) {
    if(expressionsList){
      /**
       * tous sélectionnés par défaut
       */
      if (this.selectedCategories?.length == 0) {
        expressionsList.selectAll()
      } else {
        this.selectedCategories.map((category) => {
          let selectedCategory = expressionsList.options.find((selection) => selection.value == category)
          selectedCategory.selected = true
        })

        if(expressionsList.options.filter((s) => s.selected).length==1){
          let lastOptionSelected = expressionsList.options.find((s) => s.selected)
          lastOptionSelected.disabled = true
        }else{
          expressionsList.options.filter((selection)=>selection.disabled).map((selection)=>selection.disabled = false)
        }
      }
      
      expressionsList.selectionChange.pipe(
        takeUntil(this.destroyed$),
        map(()=>expressionsList.options.filter((selection)=>selection.selected)),
        tap((optionsSelected)=>{
          if(optionsSelected.length==1){
            optionsSelected[0].disabled = true
          }else{
            expressionsList.options.filter((selection)=>selection.disabled).map((selection)=>selection.disabled = false)
          }
        }),
        tap((optionsSelected)=>{
          if (optionsSelected.length != expressionsList.options.length) {
            this.optionsSelected$.emit(optionsSelected.map((option)=>option.value as CategoryStyle)) 
          }else if(optionsSelected.length == expressionsList.options.length){
            this.optionsSelected$.emit([]) 
          }
          
        })
      ).subscribe()
    }
  }

  constructor(
    private changeDetector: ChangeDetectorRef,
  ) { 
  }

  ngOnInit(): void {
  }

   ngAfterContentChecked(): void {
    this.changeDetector.detectChanges();
  }
  /**
   * on destroy
   */
   ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }


}
