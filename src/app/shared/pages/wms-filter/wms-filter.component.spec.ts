import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WmsFilterComponent } from './wms-filter.component';

describe('WmsFilterComponent', () => {
  let component: WmsFilterComponent;
  let fixture: ComponentFixture<WmsFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WmsFilterComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WmsFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
