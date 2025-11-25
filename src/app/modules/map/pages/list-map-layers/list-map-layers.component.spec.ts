import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListMapLayersComponent } from './list-map-layers.component';

describe('ListMapLayersComponent', () => {
  let component: ListMapLayersComponent;
  let fixture: ComponentFixture<ListMapLayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListMapLayersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListMapLayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
