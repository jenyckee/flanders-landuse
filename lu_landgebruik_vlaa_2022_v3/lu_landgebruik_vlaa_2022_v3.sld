<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:sld="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" version="1.0.0">
  <UserLayer>
    <sld:LayerFeatureConstraints>
      <sld:FeatureTypeConstraint/>
    </sld:LayerFeatureConstraints>
    <sld:UserStyle>
      <sld:Name>lu_landgebruik_vlaa_2022_v3</sld:Name>
	  	  <sld:Title>Landgebruik - Vlaanderen - toestand 2022 - v3</sld:Title>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:RasterSymbolizer>
            <sld:ChannelSelection>
              <sld:GrayChannel>
                <sld:SourceChannelName>1</sld:SourceChannelName>
              </sld:GrayChannel>
            </sld:ChannelSelection>
            <sld:ColorMap type="values">
              <sld:ColorMapEntry color="#ff0000" quantity="1" label="Huizen en tuinen"/>
              <sld:ColorMapEntry color="#8400a8" quantity="2" label="Industrie"/>
              <sld:ColorMapEntry color="#ff00c5" quantity="3" label="Commerciële doeleinden"/>
              <sld:ColorMapEntry color="#002673" quantity="4" label="Diensten"/>
              <sld:ColorMapEntry color="#686868" quantity="5" label="Transportinfrastructuur"/>
              <sld:ColorMapEntry color="#ffaa00" quantity="6" label="Recreatie"/>
              <sld:ColorMapEntry color="#a87000" quantity="7" label="Landbouwgebouwen en -infrastructuur"/>
              <sld:ColorMapEntry color="#cccccc" quantity="8" label="Overige bebouwde terreinen"/>
              <sld:ColorMapEntry color="#828282" quantity="9" label="Overige onbebouwde terreinen"/>
              <sld:ColorMapEntry color="#dfe6a9" quantity="10" label="Actieve groeves"/>
              <sld:ColorMapEntry color="#df73ff" quantity="11" label="Luchthavens"/>
              <sld:ColorMapEntry color="#267300" quantity="12" label="Bos"/>
              <sld:ColorMapEntry color="#ffffbe" quantity="13" label="Akker"/>
              <sld:ColorMapEntry color="#a3ff73" quantity="14" label="Grasland in landbouwgebruik"/>
              <sld:ColorMapEntry color="#897044" quantity="15" label="Struikgewas"/>
              <sld:ColorMapEntry color="#ffd37f" quantity="16" label="Braakliggend en duinen"/>
              <sld:ColorMapEntry color="#005ce6" quantity="17" label="Water"/>
              <sld:ColorMapEntry color="#00a884" quantity="18" label="Moeras"/>
              <sld:ColorMapEntry color="#82ca5b" quantity="19" label="Overige graslanden"/>
            </sld:ColorMap>
          </sld:RasterSymbolizer>
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </UserLayer>
</StyledLayerDescriptor>
