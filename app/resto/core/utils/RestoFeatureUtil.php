<?php
/*
 * Copyright 2018 Jérôme Gasperi
 *
 * Licensed under the Apache License, version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

/**
 * resto feature manipulation
 */
class RestoFeatureUtil
{

    /*
     * Reference to resto context
     */
    private $context;

    /*
     * Reference to resto user
     */
    private $user;

    /*
     * Array of collections
     */
    private $collections = array();

    /**
     * Constructor
     *
     * @param RestoContext $context
     * @param RestoUser $user
     * @param array $collections
     */
    public function __construct($context, $user, $collections)
    {
        $this->context = $context;
        $this->user =$user;
        $this->collections = $collections;
    }

    /**
     *
     * Return a featureArray from an input rawFeatureArray.
     *
     * @param array $rawFeatureArray
     *
     */
    public function toFeatureArray($rawFeatureArray)
    {

        /*
         * No result - throw Not Found exception
         */
        if (!isset($rawFeatureArray) || !is_array($rawFeatureArray)) {
            RestoLogUtil::httpError(404);
        }

        /*
         * Retrieve collection from database
         */
        $collection = $this->collections[$rawFeatureArray['collection']];
        if ( !isset($collection) ) {
            $collection = (new RestoCollection($rawFeatureArray['collection'], $this->context, $this->user))->load();
            $this->collections[$rawFeatureArray['collection']] = $collection;
        }

        return $this->formatRawFeatureArray($rawFeatureArray, $collection);

    }

    /**
     * Return an array of featureArray from an input array of rawFeatureArray.
     *
     * @param array $rawFeatureArrayList
     * @return array
     */
    public function toFeatureArrayList($rawFeatureArrayList)
    {
        $featuresArray = array();
        for ($i = 0, $ii = count($rawFeatureArrayList); $i < $ii; $i++) {
            $featuresArray[] = $this->toFeatureArray($rawFeatureArrayList[$i]);
        }
        return $featuresArray;
    }

    /**
     *
     * PostgreSQL output columns are treated as string
     * thus they need to be converted to their true type
     *
     * @param Array $rawFeatureArray
     * @param RestoCollection $collection
     * @return array
     */
    private function formatRawFeatureArray($rawFeatureArray, $collection)
    {

        $featureArray = array(
            'type' => 'Feature',
            'id' => $rawFeatureArray['id'],
            'bbox' => null,
            'geometry' => null,
            'properties' => array(),
            'collection' => $collection->id,
            'links' => array(),
            'assets' => array()
        );

        if ( isset($this->context->addons['STAC']) ) {
            $featureArray = array_merge(array(
                'stac_version' => STAC::STAC_VERSION,
                'stac_extensions' => $collection->model->stacExtensions
            ), $featureArray);
        }

        foreach ($rawFeatureArray as $key => $value) {
            switch ($key) {

                case 'collection':
                    break;

                case 'assets':
                case 'geometry':
                    $featureArray[$key] = isset($value) ? json_decode($value, true) : array();
                    break;

                case 'links':
                    $featureArray[$key] = array_merge(isset($value) ? json_decode($value, true) : array(), $this->getDefaultLinks($collection, $rawFeatureArray));
                    break;

                case 'bbox4326':
                    $featureArray['bbox'] = RestoGeometryUtil::box2dTobbox($value);
                    break;

                case 'keywords':
                    $featureArray['properties'][$key] = $this->addKeywordsHref(json_decode($value, true), $collection);
                    break;

                case 'liked':
                    $featureArray['properties'][$key] = $value === 't' ? true : false;
                    break;
                
                case 'centroid':
                    $json = json_decode($value, true);
                    $featureArray['properties'][$key] = $json['coordinates'];
                    break;
                
                case 'status':
                case 'visibility':
                case 'likes':
                case 'comments':
                    $featureArray['properties'][$key] = (integer) $value;
                    break;

                case 'hashtags':
                    $featureArray['properties'][$key] = explode(',', substr($value, 1, -1));
                    break;

                case 'metadata':
                    $metadata = json_decode($value, true);
                    if (isset($metadata))
                    {
                        foreach (array_keys($metadata) as $metadataKey) {
                            $featureArray['properties'][$metadataKey] = $metadata[$metadataKey];
                        }    
                    }
                    break;

                default:
                    $featureArray['properties'][$key] = $value;

            }
        }

        return $featureArray;

    }


    /**
     *
     * Add href to keywords
     *
     * @param array $keywords
     * @param RestoCollection $collection
     *
     * @return array
     */
    private function addKeywordsHref($keywords, $collection)
    {
        
        if (isset($keywords)) {
            foreach (array_keys($keywords) as $key) {
                $keywords[$key]['href'] = RestoUtil::updateUrl($this->context->core['baseUrl'] . '/collections/' . $collection->id . '/items', array(
                    $collection->model->searchFilters['language']['osKey'] => $this->context->lang,
                    $collection->model->searchFilters['searchTerms']['osKey'] => '#' . $keywords[$key]['id']
                ));
            }
        }

        return $keywords;
    }

    /**
     * Get default feature links i.e. self, parent and collection links
     * 
     * @param RestoCollection $collection
     * @param array $rawFeatureArray
     * @return array
     */
    private function getDefaultLinks($collection, $rawFeatureArray) 
    {
        return array(
            array(
                'rel' => 'self',
                'type' => RestoUtil::$contentTypes['geojson'],
                'href' => RestoUtil::updateUrl($this->context->core['baseUrl'] . '/collections/' . $collection->id . '/items/' . $rawFeatureArray['id'], array($collection->model->searchFilters['language']['osKey'] => $this->context->lang))
            ),
            array(
                'rel' => 'collection',
                'type' => RestoUtil::$contentTypes['json'],
                'title' => $collection->id,
                'href' => RestoUtil::updateUrl($this->context->core['baseUrl'] . '/collections/' . $collection->id, array($collection->model->searchFilters['language']['osKey'] => $this->context->lang))
            )
        );
    }

}
