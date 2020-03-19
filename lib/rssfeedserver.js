const FeedParser = require('feedparser');
const request = require('request'); // for fetching the feed

function rssfeedclass(adapter) {
    
    this.stateTemplate = {
        'rss': {
            name:   'rss',
            read:   true,
            write:  false,
            type:   'string',
            role:   'value'
        },
    };
    
    this.defmeta = [
        "title",
        "description",
        "link",
        "xmlurl",
        "date",
        "pubdate",
        "author",
        "language",
        "image",
        "favicon",
        "copyright",
        "generator",
        "categories"
    ];

    this.defarticle = [
        "title",
        "description",
        "summary",
        "link",
        "origlink",
        "permalink",
        "date",
        "pubdate",
        "author",
        "guid",
        "comments",
        "image",
        "categories",
        "source",
        "enclosures"
    ];
    
    this.adapter = adapter;
    this.log = {};
    this.logsilly = false;
    this.logdebug = true;
    this.observers = [];
    this.lastrequest = [];

    this.init = function() {
        this.setState('connection', true, 'info');
        this.doObserver();
    };
    this.doObserver = function() {
        this.log.silly('doObserver');       
        
        this.getData();
        this.setTimeout('doObserver',this.doObserver.bind(this),60*1000); //production every minute
        //this.setTimeout('doObserver',this.doObserver.bind(this),1000); //test every second
    };
    
    this.getData = function() {
        this.log.silly('getData');       
        var rss = JSON.parse(this.adapter.config.rss);
        rss.forEach(function(item) {
            var lastrequest = this.lastrequest[item.name] || 0;
            if (lastrequest + (item.refresh * 60 * 1000)< Date.now()) {
                this.lastrequest[item.name] = Date.now();
                this.request(item.url,function(item,err,data){
                    if (!err) {
                        this.log.debug('got articles #: ' + data.articles.length + ' from '+item.name);
                        var stateTemplate = this.stateTemplate['rss'];
						stateTemplate.name = item.name;
                        this.adapter.createState(false,false,item.name,stateTemplate);
                        this.setState(item.name,JSON.stringify(data));
                    }
                }.bind(this,item));
            }
        }.bind(this));
    }
    
    this.createState = function(stateTemplate,level1path=false,level2path=false,callback) {       
        const name = (level1path ? level1path + '.' : '') + (level2path ? level2path + '.' : '') + stateTemplate.name;
        this.log.silly('Create Key ' + name);
        this.adapter.createState(level1path,level2path,stateTemplate.name,stateTemplate,callback);
    };
    this.setState = function(name, value,level1path=false,level2path=false,callback) {
        this.log.silly('calcActualGameDay');
        name = (level1path ? level1path + '.' : '') + (level2path ? level2path + '.' : '') + name;
        this.adapter.log.silly('setState name: ' + name + ' value: ' + value);
        this.adapter.setState(name, value, true, callback);
    };
    
    this.request = function(url,callback) {
        this.log.debug('request: ' + url);
        var that = this;
        var data = {};
		var counter=0;
        var req = request(url)
        var feedparser = new FeedParser();
         
        req.on('error', function (err) {
            // handle any request errors
            that.log.error (err.toString());
            callback (err);
            
        });
         
        req.on('response', function (res) {
            var stream = this; // `this` is `req`, which is a stream

            if (res.statusCode !== 200) {
                this.emit('error', new Error('Bad status code'));
            } else {
                stream.pipe(feedparser);
            }
        });
         
        feedparser.on ("error", function (err) {
            that.log.error (err.toString());
            callback (err);
		});

         
        feedparser.on('readable', function () {
            // This is where the action is!
            var stream = this; // `this` is `feedparser`, which is a stream
            var meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
            var item;
            if(!data.hasOwnProperty('meta')) {
                data['meta'] = that.filterattributes(that.defmeta,meta);
                data['articles'] = [];
            }
            while (item = stream.read()) {
                that.log.silly(item);
				if (counter>=that.adapter.config.maxarticles) return;
				counter++;
                data['articles'].push(that.filterattributes(that.defarticle,item));
            }
        });
        feedparser.on ("end", function () {
            callback (undefined, data);
		});
    }
    
    this.filterattributes = function(filter,attributes) {
        var obj = {};
        for (const key in filter){
        if (attributes.hasOwnProperty(filter[key])) {
                obj[filter[key]] = attributes[filter[key]];
            }
        }
        return obj;
    }
    this.setTimeout = function(id,callback,time) {
        this.clearTimeout(id);
        this.observers[id]= setTimeout(callback.bind(this),time);
    };
    
    this.setInterval = function(id,callback,time) {
        this.clearInterval(id);
        this.observers[id]= setInterval(callback.bind(this),time);
    };
    this.clearInterval = function(id) {
        if (this.observers[id]) clearInterval(this.observers[id]);
        delete this.observers[id];
    };
    this.clearTimeout = function(id) {
        if (this.observers[id]) clearTimeout(this.observers[id]);
        delete this.observers[id];
    };
    this.deleteObservers = function() {
        this.log.debug('deleteObservers');        
        this.clearTimeout('doObserver');
    };
    this.closeConnections = function() {
        this.log.debug('closeConnections');        
        this.deleteObservers();
    }        
    this.log.silly = function(s) {
        if (this.logsilly) this.adapter.log.silly(s);
    }.bind(this);
    this.log.debug = function(s) {
        if (this.logdebug) this.adapter.log.debug(s);
    }.bind(this);
    this.log.error = function(s) {
        this.adapter.log.error(s);
    }.bind(this);
    this.log.info = function(s) {
        this.adapter.log.info(s);
    }.bind(this);

    this.init.bind(this)(); 
     
}
module.exports = rssfeedclass;