/*
 * RESTo
 * 
 * RESTo - REstful Semantic search Tool for geOspatial 
 * 
 * Copyright 2013 Jérôme Gasperi <https://github.com/jjrom>
 * 
 * jerome[dot]gasperi[at]gmail[dot]com
 * 
 * 
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 * 
 */
(function(window) {
   
     window.Resto = {  
        
        /*
         * Initialize RESTo
         * 
         * @param {array} options
         * @param {Object} data
         */
        init: function(options, data) {

            var self = this;
            
            /*
             * Initialize variables
             */
            self.issuer = options.issuer || 'getCollection';
            self.language = options.language || 'en';
            self.restoUrl = options.restoUrl || '';
            self.collection = options.collection || null;
            self.Util.translation = options.translation || {};
            self.Header.ssoServices = options.ssoServices || {};
            self.Header.userProfile = options.userProfile || {};
            
            /*
             * Input data is a GeoJSON object
             */
            this.data = data;
            
            /*
             * Set header
             */
            this.Header.init();
            
            /*
             * Show active panel and hide others
             */
            $('.resto-panel').each(function() {
                $(this).hasClass('active') ? $(this).show() : $(this).hide();
            });
            
            /*
             * Set trigger for panels
             */
            $('.resto-panel-trigger').click(function(e){
                e.preventDefault();
                self.switchTo($(this));
            });
            
            /*
             * Update searchForm input
             */
            $("#resto-searchform").submit(function(e) {
                
                e.preventDefault();
                
                /*
                 * Reload page instead of update page
                 */
                if ($(this).attr('changeLocation')) {
                    window.Resto.Util.showMask();
                    this.submit();
                    return false;
                }
                
                /*
                 * Bound search to map view
                 */
                window.History.pushState({randomize: window.Math.random()}, null, '?' + $(this).serialize() + (window.Resto.Map.isVisible() ? '&box=' + window.Resto.Map.getBBOX() : ''));
            });
            
            $("#searchsubmit").click(function(e) {
                e.preventDefault();
                $("#resto-searchform").submit();
            });
            
            /*
             * Force focus on search input form
             */
            $('#search').focus();
            
            /*
             * init(options) was called by getCollection
             */
            if (this.issuer === 'getCollection') {
                    
                if (this.data) {
                    this.updateGetCollection(data, {
                        updateMap: false,
                        centerMap: data && data.query
                    });
                }
                
                /*
                 * Bind history change with update collection action
                 */
                this.onHistoryChange(this.updateGetCollection);
                
                /*
                 * Infinite scroll
                 */
                /*
                var state = window.History.getState(), url = self.Util.updateUrlFormat(state.cleanUrl, 'json');
                self.Util.infiniteScroll(url, 'json', {'startIndex':1}, self.updateGetCollection, 500);
                */
            }
            
            this.Util.hideMask();

        },
        
        
        /**
         * Bind history state change
         * 
         * @param {function} callback // callback function to call on state change
         * 
         */
        onHistoryChange: function(callback) {
            
            var self = this;
            
            /*
             * State change - Ajax call to RESTo backend server
             */
            window.History.Adapter.bind(window, 'statechange', function() {

                // Be sure that json is called !
                var state = window.History.getState(), url = self.Util.updateUrlFormat(state.cleanUrl, 'json');

                self.Util.showMask();

                $.ajax({
                    url: url,
                    async: true,
                    dataType: 'json',
                    success: function(json) {
                        self.Util.hideMask();
                        if (typeof callback === 'function') {
                            callback(json, {
                                updateMap:true,
                                centerMap:true
                                //centerMap:(state.data && state.data.centerMap) || (json.query && json.query.hasLocation) ? true : false
                            });
                        }
                    },
                    error: function(e) {
                        self.Util.hideMask();
                        self.Util.message("Connection error");
                    }
                });
            });
            
            /*
             * Anchor change ===> panel switch TODO
             *
            window.History.Adapter.bind(window, 'anchorchange', function() {
                //self.switchTo($('#' + window.History.getHash()));
            });
            */
        },
        
        /**
         * Switch view to input panel triggered by $trigger
         * 
         * @param {jQueryObject} $trigger
         */
        switchTo: function($trigger) {
            
            var $panel = $($trigger.attr('href'));
            
            $('.resto-panel').each(function() {
                $(this).removeClass('active').hide();
            });
            $('.resto-panel-trigger').each(function() {
                $(this).removeClass('active');
            });
            $trigger.addClass('active');
            $panel.addClass('active').show();
            //window.History.pushState({randomize: window.Math.random()}, null, window.History.getState().cleanUrl.split('#')[0] + '#' + $panel.attr('id'));
            
            /*
             * Map special case
             */
            if ($panel.attr('id') === 'panel-map') {
                this.Map.init(this.data);
            }
        },
        
        /**
         * Return textual resolution from value in meters
         * 
         * @param {integer} value
         */
        getResolution: function(value) {

            if (!$.isNumeric(value)) {
                return null;
            }

            if (value <= 2.5) {
                return 'THR';
            }

            if (value > 2.5 && value <= 30) {
                return 'HR';
            }

            if (value > 30 && value <= 500) {
                return 'MR';
            }

            return 'LR';

        },
        
       /**
        * Update getCollection page
        * 
        * @param {array} json
        * @param {boolean} options 
        *          {
        *              updateMap: // true to update map content
        *              centerMap: // true to center map on content
        *          }
        * 
        */
        updateGetCollection: function(json, options) {

            var foundFilters, key, p, self = window.Resto;

            json = json || {};
            p = json.properties || {};
            options = options || {};

            /*
             * Update search input form - TODO
             */
            if ($('#search').length > 0) {
                $('#search').val(p.query ? self.Util.sanitizeValue(p.query.original.searchTerms) : '');
            }
            
            /*
             * Update result summary - TODO
             */
            $('#resultsummary').html(self.Util.translate('_resultFor', [(p.query.original.searchTerms ? '<font class="red">' + self.Util.sanitizeValue(p.query.original.searchTerms) + '</font>' : '')]));
            
            /*
             * Update query analysis result - TODO
             */
            if (p.query && p.query.real) {
                foundFilters = "";
                for (key in p.query.real) {
                    if (p.query.real[key]) {
                        if (key !== 'language') {
                            foundFilters += '<b>' + key + '</b> ' + p.query.real[key] + '</br>';
                        }
                    }
                }
                if (foundFilters) {
                    $('.resto-queryanalyze').html('<div class="resto-query">' + foundFilters + '</div>');
                }
                else {
                    $('.resto-queryanalyze').html('<div class="resto-query"><span class="resto-warning">' + self.Util.translate('_notUnderstood') + '</span></div>');
                }
            }
            else if (p.missing) {
                $('.resto-queryanalyze').html('<div class="resto-query"><span class="resto-warning">Missing mandatory search filters - ' + p.missing.concat() + '</span></div>');
            }

            /*
             * Update result
             */
            self.updateGetCollectionResultEntries(json);

            /*
             * Update map view
             */
            if (options.updateMap) {
                window.Resto.Map.updateLayer(json, options.centerMap);
            }
            
            /*
             * Click on ajaxified element call href url through Ajax
             */
            $('.resto-ajaxified').each(function() {
                $(this).click(function(e) {
                    e.preventDefault();
                    window.History.pushState({
                        randomize: window.Math.random(),
                        centerMap: $(this).hasClass('centerMap')
                    }, null, $(this).attr('href'));
                    $('html, body').scrollTop(0);
                });
            });
            
            /*
             * Align heights
             */
            self.Util.alignHeight($('.resto-feature'));
        },

        /**
         * Update GetCollection result entries after a search
         * 
         * @param {array} json
         */
        updateGetCollectionResultEntries: function(json) {

            var i, l, j, k, p, image,
                    feature, key, keyword, keywords, type,
                    $div, $container, $actions, value, title, addClass,
                    platform, results, resolution, self = this;

            json = json || {};
            p = json.properties || {};

            /*
             * Update pagination - TODO
             */
            var first = '', previous = '', next = '', last = '', pagination = '', selfUrl = '#';

            if (p.missing) {
                pagination = '';
            }
            else if (p.totalResults === 0) {
                pagination = self.Util.translate('_noResult');
            }
            else {
                
                if ($.isArray(p.links)) {
                    for (i = 0, l = p.links.length; i < l; i++) {
                        if (p.links[i]['rel'] === 'first') {
                            first = ' <a class="resto-ajaxified" href="' + self.Util.updateUrlFormat(p.links[i]['href'], 'html') + '">' + self.Util.translate('_firstPage') + '</a> ';
                        }
                        if (p.links[i]['rel'] === 'previous') {
                            previous = ' <a class="resto-ajaxified" href="' + self.Util.updateUrlFormat(p.links[i]['href'], 'html') + '">' + self.Util.translate('_previousPage') + '</a> ';
                        }
                        if (p.links[i]['rel'] === 'next') {
                            next = ' <a class="resto-ajaxified" href="' + self.Util.updateUrlFormat(p.links[i]['href'], 'html') + '">' + self.Util.translate('_nextPage') + '</a> ';
                        }
                        if (p.links[i]['rel'] === 'last') {
                            last = ' <a class="resto-ajaxified" href="' + self.Util.updateUrlFormat(p.links[i]['href'], 'html') + '">' + self.Util.translate('_lastPage') + '</a> ';
                        }
                        if (p.links[i]['rel'] === 'self') {
                            selfUrl = p.links[i]['href'];
                        }
                    }
                }
                
                /*
                 * Pagination text
                 */
                pagination += first + previous + (p.itemsPerPage ? self.Util.translate('_pageNumber', [Math.ceil(p.startIndex / p.itemsPerPage)]) : '') + next + last;

            }

            /*
             * Update each pagination element - TODO
             */
            $('.resto-pagination').each(function() {
                $(this).html(pagination);
            });

            /*
             * Iterate on features and update result container
             */
            $container = $('.resto-features-container').empty();
            for (i = 0, l = json.features.length; i < l; i++) {

                feature = json.features[i];

                /*
                 * Quicklook
                 */
                image = feature.properties['quicklook'] || feature.properties['thumbnail'] || self.restoUrl + '/css/default/img/noimage.png';

                /*
                 * Satellite
                 */
                platform = feature.properties['platform'];
                if (feature.properties.keywords) {
                    for (var z = feature.properties.keywords.length; z--;) {
                        if (feature.properties.keywords[z]['name'] === feature.properties['platform']) {
                            platform = '<a href="' + self.Util.updateUrlFormat(feature.properties.keywords[z]['href'], 'html') + '" class="resto-ajaxified resto-updatebbox resto-keyword resto-keyword-platform" title="' + self.Util.translate('_thisResourceWasAcquiredBy', [feature.properties['platform']]) + '">' + feature.properties['platform'] + '</a> ';
                            break;
                        }
                    }
                }

                /*
                 * Resource page
                 */
                var resourceUrl = '#';
                if ($.isArray(feature.properties['links'])) {
                    for (j = 0, k = feature.properties['links'].length; j < k; j++) {
                        if (feature.properties['links'][j]['type'] === 'text/html') {
                            resourceUrl = self.Util.updateUrl(feature.properties['links'][j]['href'], {lang:self.language});
                        }
                    }
                }

                /*
                 * Display structure
                 *  
                 *  <li>
                 *      <div id="rid...">
                 *          <div class="streched">
                 *              <div class="feature-info-top"></div>
                 *              <div class="feature-info-bottom"></div>
                 *          </div>
                 *      </div>
                 *  </li>
                 * 
                 */
                $container.append('<li style="position:relative;padding:0px;"><div id="' + feature.id + '" class="resto-feature"><div class="bg-alpha-dark-hover streched"><div class="padded pin-top feature-info-top"></div><div class="padded pin-bottom feature-info-bottom link-light"></div></div></div></li>');
                $div = $('#' + feature.id)
                        .css({
                            'background': "url('" + image + "') no-repeat",
                            '-webkit-background-size': 'cover',
                            '-moz-background-size': 'cover',
                            '-o-background-size': 'cover',
                            'background-size': 'cover',
                            'height': '350px',
                            'box-sizing': 'border-box',
                            'padding': '0px',
                            'cursor': 'pointer'
                        }).click(function (e) {
                            $(this).hasClass('selected') ? self.unselectAll() : self.selectFeature($(this).attr('id'), false);
                        });
                        
                        
                /*
                 * Feature info top
                 */
                $('.feature-info-top', $div).html('<h3 class="small text-light">' + self.Util.niceDate(feature.properties.startDate) + '</h3><h1 class="small text-light">Test</h1>');
                
                
                /*
                 * Zoom on feature
                 */
                $('.feature-info-bottom', $div).append('<a class="fa fa-2x fa-map-marker showOnMap" href="#" title="' + self.Util.translate('_showOnMap') + '"></a>');

                /*
                 * Show feature on map
                 */
                (function($div){
                    $('.showOnMap', $div).click(function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.switchTo($('#resto-panel-trigger-map'));
                        self.Map.hilite($div.attr('id'), true);
                        return false;
                    });
                })($div);
                
                /*
                 * Download
                 */
                if (feature.properties['services'] && feature.properties['services']['download'] && feature.properties['services']['download']['url']) {
                    //if (self.userRights && self.userRights['download']) {
                        $('.feature-info-bottom', $div).append('<a class="fa fa-2x fa-cloud-download" href="' + feature.properties['services']['download']['url'] + '"' + (feature.properties['services']['download']['mimeType'] === 'text/html' ? ' target="_blank"' : '') + ' title="' + self.Util.translate('_download') + '"></a>');
                    //}
                }
                
                /*
                 * Add to cart
                 */
                $('.feature-info-bottom', $div).append('<a class="fa fa-2x fa-shopping-cart addToCart" href="#" title="' + self.Util.translate('_addToCart') + '"></a>');
                
                continue;
                
                $container.append('<li><div class="resto-feature" id="rid' + i + '" fid="' + feature.id + '"><div class="padded-bottom"><span class="platform">' + platform + (platform && feature.properties['instrument'] ? "/" + feature.properties['instrument'] : "") + '</span> | <span class="timestamp">' + feature.properties['startDate'] + '</span></div><div><a href="' + resourceUrl + '" title="' + self.Util.translate('_viewMetadata', [feature.id]) + '"><img class="resto-image" src="' + thumbnail + '"/></a></div><div class="resto-actions"></div><div class="resto-keywords"></div></div></li>');
                $actions = $('.resto-actions', $('#rid' + i));
                
                /*
                 * Keywords are splitted in different types 
                 * 
                 *  - type = landuse (forest, water, etc.)
                 *  - type = country/continent/region/state/city
                 *  - type = platform/instrument
                 *  - type = date
                 *  - type = null and keyword start with a '#' = tags
                 *  
                 */
                if (feature.properties.keywords) {
                    results = [];
                    keywords = {
                        landuse: {
                            title: '_landUse',
                            keywords: []
                        },
                        location: {
                            title: '_location',
                            keywords: []
                        },
                        tag: {
                            title: '_tags',
                            keywords: []
                        },
                        resolution: {
                            title: '_resolution',
                            keywords: []
                        },
                        other: {
                            title: '_other',
                            keywords: []
                        }
                    };
                    for (var iterator in feature.properties.keywords) {
                        keyword = feature.properties.keywords[iterator];
                        var text = keyword['name'];
                        var typeAndId = keyword.id.split(':'),
                        title = "";
                        addClass = null;
                        if (typeAndId[0] === 'day') {
                            
                        }
                        else if (typeAndId[0] === 'landuse') {
                            type = 'landuse';
                            text = text + ' (' + Math.round(keyword.value) + '%)';
                            addClass = ' resto-updatebbox resto-keyword-' + typeAndId[0] + '_' + typeAndId[1];
                            title = self.Util.translate('_thisResourceContainsLanduse', [keyword.value, key]);
                        }
                        else if (typeAndId[0] === 'country' || typeAndId[0] === 'continent' || typeAndId[0] === 'region' || typeAndId[0] === 'state') {
                            type = 'location';
                            addClass = ' centerMap';
                            title = self.Util.translate('_thisResourceIsLocated', [text]);
                        }
                        else if (typeAndId[0] === 'city') {
                            type = 'location';
                            addClass = ' centerMap';
                            title = self.Util.translate('_thisResourceContainsCity', [text]);
                        }
                        else if (typeAndId[0] === 'platform' || typeAndId[0] === 'instrument') {
                            continue;
                        }
                        else if (typeAndId[0] === 'date') {
                            continue;
                        }
                        else if (keyword.name.indexOf("#") === 0) {
                            type = 'tag';
                            addClass = ' resto-updatebbox';
                        }
                        else {
                            type = 'other';
                            addClass = ' resto-updatebbox';
                        }
                        keywords[type]['keywords'].push('<a href="' + self.Util.updateUrlFormat(keyword['href'], 'html') + '" class="resto-ajaxified resto-keyword' + (typeAndId[0] ? ' resto-keyword-' + typeAndId[0].replace(' ', '') : '') + (addClass ? addClass : '') + '" title="' + title + '">' + text + '</a> ');
                    }

                    /*
                     * Resolution
                     */
                    if (feature.properties['resolution']) {
                        resolution = self.getResolution(feature.properties['resolution']);
                        keywords['resolution']['keywords'].push(feature.properties['resolution'] + 'm - <a href="' + self.Util.updateUrl(self.Util.updateUrlFormat(selfUrl, 'html'), {q: self.Util.translate(resolution)}) + '" class="resto-ajaxified resto-updatebbox resto-keyword resto-keyword-resolution" title="' + self.Util.translate(resolution) + '">' + resolution + '</a>');
                    }

                    for (key in keywords) {
                        if (keywords[key]['keywords'].length > 0) {
                            results.push('<td class="title">' + self.Util.translate(keywords[key]['title']) + '</td><td class="values">' + keywords[key]['keywords'].join(', ') + '</td>');
                        }
                    }

                    $('.resto-keywords', $('#rid' + i)).html('<table>' + results.join('</tr>') + '</table>');
                }

            }

        },
        
        /**
         * Select feature id
         * 
         * @param {string} id
         */
        selectFeature: function(id, scroll) {
            
            var $id = $('#' + id);
            
            this.unselectAll();
            
            /*
             * Switch to list view
             */
            this.switchTo($('#resto-panel-trigger-list'));
            $('.resto-feature').each(function () {
                $(this).addClass('darker');
            });
            $id.addClass('selected').removeClass('darker').children().first().removeClass('bg-alpha-dark-hover');
            if (scroll) {
                $('html, body').scrollTop($id.offset().top);
            }
            
            /*
             * Compute position
             */
            var left = $id.offset().left,
                top = $id.offset().top;
            if (left + (2 * $id.outerWidth()) > $(window).width()) {
                if (left - $id.outerWidth() < 0) {
                    top = top + $id.outerHeight();
                }
                else {
                    left = left - $id.outerWidth();
                }
            }
            else {
                left = left + $id.outerWidth();
            }
            $('#feature-info-details').css({
                'position': 'absolute',
                'height': $id.outerHeight() + 'px',
                'top': top + 'px',
                'left': left + 'px',
                'width':$id.outerWidth() + 'px',
                'z-index':'10000',
                'background-color':'#000'
            }).show();
        },
        
        /**
         * Unselect all features
         */
        unselectAll: function() {
            $('.resto-feature').each(function () {
                $(this).removeClass('selected darker').children().first().addClass('bg-alpha-dark-hover');
            });
            $('#feature-info-details').hide();
        }
    };
    
    window.Resto.Header = {
        
        ssoServices: {},
        
        init: function() {
            
            var self = this;
            
            /*
             * Set Oauth servers
             */
            self.setOAuthServers();
            
            /*
             * Share on facebook
             */
            $('.shareOnFacebook').click(function(e) {
                e.preventDefault();
                window.open('https://www.facebook.com/sharer.php?u=' + encodeURIComponent(window.History.getState().cleanUrl) + '&t=' + encodeURIComponent(self.Util.sanitizeValue($('#search'))));
                return false;
            });

            /*
             * Share to twitter
             */
            $('.shareOnTwitter').click(function(e) {
                e.preventDefault();
                window.open('http://twitter.com/intent/tweet?status=' + encodeURIComponent(self.Util.sanitizeValue($('#search')) + " - " + window.History.getState().cleanUrl));
                return false;
            });

            /*
             * Show gravatar if user is connected
             */
            $('.gravatar').css('background-image', 'url(' + window.Resto.Util.getGravatar(self.userProfile.userhash, 200) + ')');
            
            /*
             * Sign in locally
             */
            $('.signIn').click(function(e) {
                e.preventDefault();
                self.signIn();
                return false;
            });
            
            /*
             * Register
             */
            $('.register').click(function(e){
                e.preventDefault();
                self.signUp();
                return false;
            });
            
            /*
             * Collection info trigger
             */
            $('.resto-collection-info-trigger').click(function(e){
                e.preventDefault();
                if ($('.resto-collection-info').is(':visible')) {
                    $('.resto-collection-info').slideUp();
                    $(this).removeClass('active');
                }
                else {
                    $('.resto-collection-info').slideDown();
                    $(this).addClass('active');
                }
                return false;
            });
            
            /*
             * Events
             */
            $('#userPassword').keypress(function (e) {
                if (e.which === 13) {
                    $('.signIn').trigger('click');
                    return false;
                }
            });
            $('#userPassword1').keypress(function (e) {
                if (e.which === 13) {
                    $('.register').trigger('click');
                    return false;
                }
            });
            
            $(document).on('opened.fndtn.reveal', '[data-reveal]', function () {
                switch($(this).attr('id')) {
                    case 'displayRegister':
                        $('#userName').focus();
                        break;
                    case 'displayLogin':
                        $('#userEmail').focus();
                        break;
                    case 'displayProfile':
                        self.showProfile();
                        break;
                    default:
                        break;
                }
            });
            
            $(window).resize(function(){
                $('.resto_menu').hide();
            });
            
            
            this.createSmallMenu();
            
        },
     
        /**
         * Sign in
         */
        signIn: function() {
            
            Resto.Util.showMask();
            Resto.Util.ajax({
                url: Resto.restoUrl + 'api/users/connect',
                headers: {
                    'Authorization': "Basic " + btoa(Resto.Util.sanitizeValue($('#userEmail')) + ":" + Resto.Util.sanitizeValue($('#userPassword')))
                },
                dataType: 'json',
                success: function (json) {
                    if (json && json.userid === -1) {
                        Resto.Util.hideMask();
                        Resto.Util.alert($('#displayLogin'), 'Error - unknown user or incorrect password');
                    }
                    else {
                        window.location.reload();
                    }
                },
                error: function (e) {
                    Resto.Util.hideMask();
                    Resto.Util.alert($('#displayLogin'), 'Error - cannot sign in');
                }
            });
        },
        
        /**
         * Register
         */
        signUp: function() {
            var username = Resto.Util.sanitizeValue($('#userName')), 
                password1 = Resto.Util.sanitizeValue($('#userPassword1')),
                email = Resto.Util.sanitizeValue($('#r_userEmail')),
                $div = $('#displayRegister');

            if (!email || !Resto.Util.isEmailAdress(email)) {
                Resto.Util.alert($div, 'Email is not valid');
            }
            else if (!username) {
                Resto.Util.alert($div, 'Username is mandatory');
            }
            else if (!password1) {
                Resto.Util.alert($div, 'Password is mandatory');
            }
            else {
                Resto.Util.ajax({
                    url: Resto.restoUrl + 'users',
                    async: true,
                    type: 'POST',
                    dataType: "json",
                    data: {
                        email: email,
                        password: password1,
                        username: username,
                        givenname: Resto.Util.sanitizeValue($('#firstName')),
                        lastname: Resto.Util.sanitizeValue($('#lastName'))
                    },
                    success: function (json) {
                        if (json && json.Status === 'success') {
                            window.location.reload();
                        }
                        else {
                            Resto.Util.alert($div, json.ErrorMessage);
                        }
                    },
                    error: function (e) {
                        if (e.responseJSON) {
                            Resto.Util.alert($div, e.responseJSON.ErrorMessage);
                        }
                        else {
                            Resto.Util.alert($div, 'Error : cannot register');
                        }
                    }
                }, true);
            }
        },
        
        /**
         * Show user profile
         */
        showProfile: function() {
            
            var $div = $('#displayProfile');
            $div.html('<div class="padded large-12 columns center"><img class="gravatar-big" src="' + window.Resto.Util.getGravatar(this.userProfile.userhash, 200) + '"/><a class="button signOut">' + window.Resto.Util.translate('_logout') + '</a></div>');
            $('.signOut').click(function() {
                window.Resto.Util.showMask();
                window.Resto.Util.ajax({
                    url: window.Resto.restoUrl + 'api/users/disconnect',
                    dataType:'json',
                    success: function(json) {
                        window.location.reload();
                    },
                    error: function(e) {
                        window.Resto.Util.hideMask();
                        Resto.Util.alert($div, 'Error : cannot disconnect');
                    }
                });
                return false;
            });
        },
        
        /**
         * OAuth (e.g. google)
         */
        setOAuthServers: function () {
            var self = this;
            for (var key in self.ssoServices) {
                (function (key) {
                    $('.signWithOauth').append('<span id="_oauth' + key + '">' + self.ssoServices[key].button + '</span>');
                    $('a', '#_oauth' + key).click(function (e) {
                        
                        e.preventDefault();
                        
                        /*
                         * Open SSO authentication window
                         */
                        var popup = window.open(self.ssoServices[key].authorizeUrl);
                        
                        /*
                         * Load user profile after popup has been closed
                         */
                        var fct = setInterval(function () {
                            if (popup.closed) {
                                clearInterval(fct);
                                window.location.reload();
                            }
                        }, 200);
                        return false;
                    });
                })(key);
            }
        },
        
        createSmallMenu: function(){
            $('.small_menu').hide();
            $('.small_menu_button').on('click', function(){
                $('.small_menu').is(':visible') ? $('.small_menu').hide() : $('.small_menu').show();
            });
        }        

    };

})(window);
