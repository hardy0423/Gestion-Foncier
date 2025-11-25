import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchLayerComponent } from './search-layer.component';

describe('SearchLayerComponent', () => {
  let component: SearchLayerComponent;
  let fixture: ComponentFixture<SearchLayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SearchLayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchLayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
